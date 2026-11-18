-- Group chat: every group has one conversation.
--
--   * Members send text messages (1 to 1000 characters) and react to any
--     message with one of five reactions. "treat" is the toss-a-treat
--     reaction: a cheer, not real treats (XP), so it can't be farmed.
--   * The app also posts a few moments into the chat: someone hit their weekly
--     goal (once per person, group and week), someone joined, and the squad
--     week was made. Group mates already see goals and squad progress, so
--     these share nothing new. Workouts stay between partners.
--   * Messages from someone you've blocked, or who blocked you, are hidden
--     both ways. Report a message with report_content(kind 'group_message').
--   * Authors delete their own messages; the group's owner can delete any.
--   * Each member has a read marker (unread counts and the Chats badge) and
--     can mute a group's chat. A new message pushes to members who aren't
--     muted, once per burst: no second push for a group until you've read it
--     or 30 minutes have passed.
--
-- Writes go through the functions below; clients only read. Messages and
-- reactions are in the realtime publication so open chats update live.

-- ─── Tables ──────────────────────────────────────────────────────────────────

alter table public.group_members
  add column last_read_at timestamptz not null default now(),
  add column chat_muted   boolean not null default false;

create table public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  -- Who sent it, or who an event is about; null for squad events.
  user_id    uuid references public.profiles (id) on delete cascade,
  kind       text not null default 'text' check (kind in ('text', 'goal_hit', 'joined', 'squad_done')),
  body       text check (body is null or char_length(btrim(body)) between 1 and 1000),
  -- The week a goal_hit or squad_done is for.
  week_start date,
  created_at timestamptz not null default now(),
  constraint group_messages_text_has_body check (kind <> 'text' or (body is not null and user_id is not null))
);

create index group_messages_group_idx on public.group_messages (group_id, created_at desc);
create unique index group_messages_goal_once_idx on public.group_messages (group_id, user_id, week_start)
  where kind = 'goal_hit';
create unique index group_messages_squad_once_idx on public.group_messages (group_id, week_start)
  where kind = 'squad_done';

create table public.group_message_reactions (
  message_id uuid not null references public.group_messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  reaction   text not null check (reaction in ('heart', 'fire', 'strong', 'laugh', 'treat')),
  -- Copied from the message so realtime can filter by group.
  group_id   uuid not null references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction)
);

create index group_message_reactions_group_idx on public.group_message_reactions (group_id);

alter table public.group_messages          enable row level security;
alter table public.group_message_reactions enable row level security;

-- ─── Reading ─────────────────────────────────────────────────────────────────

-- Can you see a message (or reaction) in p_group by p_author? Members only,
-- and never across a block. Only ever answers for you, so it can't be used to
-- learn who blocked whom.
create function public.can_see_group_message(p_group uuid, p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_group_member(p_group, auth.uid())
     and (p_author is null or p_author = auth.uid() or not public.is_blocked_between(p_author, auth.uid()));
$$;

create policy "Members read their group's chat" on public.group_messages
  for select to authenticated
  using (public.can_see_group_message(group_id, user_id));

create policy "Members read reactions in their group's chat" on public.group_message_reactions
  for select to authenticated
  using (public.can_see_group_message(group_id, user_id));

grant select on public.group_messages, public.group_message_reactions to authenticated;

-- A page of the chat, newest first: the author's first name, buddy and photo,
-- and each reaction with its count and whether you added it.
create function public.group_chat(p_group uuid, p_before timestamptz default null, p_limit integer default 60)
returns table (
  id uuid, user_id uuid, kind text, body text, created_at timestamptz,
  name text, mascot text, avatar_url text, is_me boolean, reactions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, m.kind, m.body, m.created_at,
         coalesce(nullif(split_part(p.display_name, ' ', 1), ''), 'Someone'),
         p.mascot::text,
         p.avatar_url,
         coalesce(m.user_id = auth.uid(), false),
         coalesce((
           select jsonb_agg(jsonb_build_object('reaction', r.reaction, 'count', r.n, 'mine', r.mine)
                            order by r.first_at)
           from (
             select x.reaction, count(*)::int as n, bool_or(x.user_id = auth.uid()) as mine,
                    min(x.created_at) as first_at
             from public.group_message_reactions x
             where x.message_id = m.id and not public.is_blocked_between(x.user_id, auth.uid())
             group by x.reaction
           ) r
         ), '[]'::jsonb)
  from public.group_messages m
  left join public.profiles p on p.id = m.user_id
  where m.group_id = p_group
    and public.can_see_group_message(m.group_id, m.user_id)
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

-- One row per group you're in, for the Chats tab: the newest message you can
-- see, how many you haven't read, and whether you muted it.
create function public.my_chats()
returns table (
  group_id uuid, name text, emoji text, member_count integer, muted boolean,
  last_kind text, last_body text, last_name text, last_is_me boolean, last_at timestamptz,
  unread integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, g.emoji,
         (select count(*)::int from public.group_members x where x.group_id = g.id),
         me.chat_muted,
         l.kind, l.body,
         coalesce(nullif(split_part(lp.display_name, ' ', 1), ''), 'Someone'),
         coalesce(l.user_id = auth.uid(), false),
         l.created_at,
         (select count(*)::int from public.group_messages u
          where u.group_id = g.id and u.created_at > me.last_read_at
            and u.user_id is distinct from auth.uid()
            and public.can_see_group_message(u.group_id, u.user_id))
  from public.group_members me
  join public.groups g on g.id = me.group_id
  left join lateral (
    select * from public.group_messages m
    where m.group_id = g.id and public.can_see_group_message(m.group_id, m.user_id)
    order by m.created_at desc, m.id desc
    limit 1
  ) l on true
  left join public.profiles lp on lp.id = l.user_id
  where me.user_id = auth.uid()
  order by coalesce(l.created_at, me.joined_at) desc;
$$;

-- ─── Writing ─────────────────────────────────────────────────────────────────

create function public.send_group_message(p_group uuid, p_body text)
returns public.group_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  result public.group_messages;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group, me) then
    raise exception 'You''re not in this group' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'Messages can be up to 1,000 characters.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.group_messages
      where user_id = me and kind = 'text' and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Slow down a little. Try again in a minute.' using errcode = 'P0001';
  end if;

  insert into public.group_messages (group_id, user_id, kind, body)
  values (p_group, me, 'text', btrim(p_body))
  returning * into result;
  update public.group_members set last_read_at = now() where group_id = p_group and user_id = me;
  return result;
end;
$$;

create function public.delete_group_message(p_message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.group_messages;
begin
  select * into m from public.group_messages where id = p_message;
  if m.id is null then
    return;
  end if;
  if m.user_id is distinct from auth.uid()
     and not exists (
       select 1 from public.group_members
       where group_id = m.group_id and user_id = auth.uid() and role = 'owner'
     ) then
    raise exception 'Only the sender or the group''s owner can delete a message' using errcode = '42501';
  end if;
  delete from public.group_messages where id = p_message;
end;
$$;

-- Adds the reaction, or takes it back if you'd already added it. Returns
-- whether it's on now.
create function public.toggle_group_reaction(p_message uuid, p_reaction text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  m  public.group_messages;
  n  integer;
begin
  select * into m from public.group_messages where id = p_message;
  if m.id is null or not public.can_see_group_message(m.group_id, m.user_id) then
    raise exception 'That message isn''t here anymore' using errcode = 'P0002';
  end if;
  delete from public.group_message_reactions
  where message_id = p_message and user_id = me and reaction = p_reaction;
  get diagnostics n = row_count;
  if n > 0 then
    return false;
  end if;
  insert into public.group_message_reactions (message_id, user_id, reaction, group_id)
  values (p_message, me, p_reaction, m.group_id);
  return true;
end;
$$;

create function public.mark_group_read(p_group uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_members set last_read_at = now()
  where group_id = p_group and user_id = auth.uid();
$$;

create function public.set_group_chat_muted(p_group uuid, p_muted boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_members set chat_muted = p_muted
  where group_id = p_group and user_id = auth.uid();
$$;

-- ─── Moments the app posts ───────────────────────────────────────────────────

-- Someone hit their weekly goal: once per person, group and week.
create function public.post_goal_hit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
  wk date;
begin
  if new.this_week_days < new.this_week_goal
     or (tg_op = 'UPDATE' and old.this_week_days >= old.this_week_goal) then
    return null;
  end if;
  select coalesce(timezone, 'UTC') into tz from public.profiles where id = new.user_id;
  wk := public.week_of((now() at time zone tz)::date);
  insert into public.group_messages (group_id, user_id, kind, week_start)
  select m.group_id, new.user_id, 'goal_hit', wk
  from public.group_members m
  where m.user_id = new.user_id
    and (select count(*) from public.group_members x where x.group_id = m.group_id) >= 2
  on conflict do nothing;
  return null;
end;
$$;

create trigger streaks_post_goal_hit
  after insert or update of this_week_days, this_week_goal on public.streaks
  for each row execute function public.post_goal_hit();

-- Someone joined (not the person who started the group).
create function public.post_member_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'member' then
    insert into public.group_messages (group_id, user_id, kind) values (new.group_id, new.user_id, 'joined');
  end if;
  return null;
end;
$$;

create trigger group_members_post_joined
  after insert on public.group_members
  for each row execute function public.post_member_joined();

-- The squad week was made (the same moment as the "made it this week" push).
create function public.post_squad_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'done' then
    insert into public.group_messages (group_id, kind, week_start)
    values (new.group_id, 'squad_done', new.week_start)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger group_week_notices_post_squad
  after insert on public.group_week_notices
  for each row execute function public.post_squad_done();

-- ─── Notifications ───────────────────────────────────────────────────────────

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('nudge', 'partner_workout', 'partner_request', 'partner_accepted', 'verified',
                    'streak_risk', 'comment', 'incentive', 'pep_talk', 'group', 'group_chat'));

-- A new text message → everyone else in the group who hasn't muted it (or
-- turned off group notifications), isn't blocked either way, and hasn't
-- already had a push for this chat since they last read it in the past 30
-- minutes.
create function public.notify_group_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g    public.groups;
  link text;
begin
  if new.kind <> 'text' then
    return null;
  end if;
  select * into g from public.groups where id = new.group_id;
  link := '/group/chat/' || g.id;

  insert into public.notifications (user_id, kind, title, body, url)
  select m.user_id, 'group_chat',
         g.emoji || ' ' || g.name,
         public.first_name(new.user_id) || ': '
           || left(new.body, 140) || case when char_length(new.body) > 140 then '…' else '' end,
         link
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  where m.group_id = g.id
    and m.user_id <> new.user_id
    and not m.chat_muted
    and p.notify_groups
    and not public.is_blocked_between(m.user_id, new.user_id)
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.user_id and n.kind = 'group_chat' and n.url = link
        and n.created_at > m.last_read_at
        and n.created_at > now() - interval '30 minutes'
    );
  return null;
end;
$$;

create trigger group_messages_notify
  after insert on public.group_messages
  for each row execute function public.notify_group_message();

-- ─── Reports ─────────────────────────────────────────────────────────────────

alter table public.content_reports
  drop constraint content_reports_kind_check,
  add constraint content_reports_kind_check
    check (kind in ('user', 'comment', 'pep_talk', 'workout', 'group_message'));

-- Same as before, plus group messages (only ones you can see).
create or replace function public.report_content(p_user uuid, p_kind text, p_ref uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := auth.uid();
  snap text;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_user = me then
    raise exception 'You can''t report yourself' using errcode = 'P0001';
  end if;

  snap := case p_kind
    when 'comment' then (
      select coalesce(c.body, '[voice message] ' || c.audio_path)
      from public.workout_comments c where c.id = p_ref and c.user_id = p_user)
    when 'pep_talk' then (
      select concat_ws(' · ', t.media_kind || ' ' || t.media_path, t.message)
      from public.pep_talks t where t.id = p_ref and t.from_id = p_user and t.to_id = me)
    when 'workout' then (
      select concat_ws(' · ', w.activity_type, w.note, array_to_string(w.photo_paths, ', '))
      from public.workouts w where w.id = p_ref and w.user_id = p_user)
    when 'group_message' then (
      select m.body from public.group_messages m
      where m.id = p_ref and m.user_id = p_user and public.is_group_member(m.group_id, me))
    else (select display_name from public.profiles where id = p_user)
  end;

  insert into public.content_reports (reporter_id, reported_id, kind, ref_id, reason, snapshot)
  values (me, p_user, p_kind, p_ref, p_reason, snap);
end;
$$;

-- ─── Realtime ────────────────────────────────────────────────────────────────

-- Deletes only need the id to reach open chats.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.group_messages, public.group_message_reactions;
  end if;
end;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.can_see_group_message(uuid, uuid) from public, anon;
revoke execute on function public.group_chat(uuid, timestamptz, integer) from public, anon;
revoke execute on function public.my_chats() from public, anon;
revoke execute on function public.send_group_message(uuid, text) from public, anon;
revoke execute on function public.delete_group_message(uuid) from public, anon;
revoke execute on function public.toggle_group_reaction(uuid, text) from public, anon;
revoke execute on function public.mark_group_read(uuid) from public, anon;
revoke execute on function public.set_group_chat_muted(uuid, boolean) from public, anon;
revoke execute on function public.post_goal_hit() from public, anon, authenticated;
revoke execute on function public.post_member_joined() from public, anon, authenticated;
revoke execute on function public.post_squad_done() from public, anon, authenticated;
revoke execute on function public.notify_group_message() from public, anon, authenticated;

grant execute on function public.can_see_group_message(uuid, uuid) to authenticated;
grant execute on function public.group_chat(uuid, timestamptz, integer) to authenticated;
grant execute on function public.my_chats() to authenticated;
grant execute on function public.send_group_message(uuid, text) to authenticated;
grant execute on function public.delete_group_message(uuid) to authenticated;
grant execute on function public.toggle_group_reaction(uuid, text) to authenticated;
grant execute on function public.mark_group_read(uuid) to authenticated;
grant execute on function public.set_group_chat_muted(uuid, boolean) to authenticated;
