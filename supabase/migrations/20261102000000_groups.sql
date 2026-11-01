-- Private groups: invite-only circles of up to 20 people (family, work, the
-- gym crew) with two things to share each week:
--   * a leaderboard: this week's XP, medals, and a crown for last week's winner
--   * a squad streak: the week counts when at least 80% of the group (rounded
--     up, so everyone in groups of 4 or fewer) hits their own weekly goal. A
--     rest week or a streak freeze counts as made, as in friend streaks.
--
-- Group mates see each other's first name, buddy, profile photo, weekly XP
-- and days toward their goal. Never workouts: that's what partners are for.
-- Everyone can be in up to 3 groups. The creator (owner) can rename the group
-- and remove people; anyone can leave. If the owner leaves, the longest-
-- standing member takes over; an empty group is deleted.
--
-- Keep the limits and the 80% rule in sync with src/lib/groups.ts.

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 30),
  emoji       text not null default '🔥' check (char_length(emoji) between 1 and 8),
  invite_code text not null unique,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- Notifications already sent, so each goes out once per group and week.
create table public.group_week_notices (
  group_id   uuid not null references public.groups (id) on delete cascade,
  week_start date not null,
  kind       text not null check (kind in ('done', 'one_more')),
  created_at timestamptz not null default now(),
  primary key (group_id, week_start, kind)
);

alter table public.groups             enable row level security;
alter table public.group_members      enable row level security;
alter table public.group_week_notices enable row level security;

alter table public.profiles add column notify_groups boolean not null default true;

-- ─── Helpers ─────────────────────────────────────────────────────────────────

create function public.is_group_member(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = p_user);
$$;

create function public.shares_group(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members x
    join public.group_members y on y.group_id = x.group_id
    where x.user_id = a and y.user_id = b
  );
$$;

-- Reads go through the functions below; these let the app read its own groups directly too.
create policy "Read own groups" on public.groups
  for select to authenticated using (public.is_group_member(id, (select auth.uid())));
create policy "Read members of own groups" on public.group_members
  for select to authenticated using (public.is_group_member(group_id, (select auth.uid())));

grant select on public.groups, public.group_members to authenticated;

-- Group mates can see each other's profile photo.
create policy "View group mates' avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.shares_group((select auth.uid()), ((storage.foldername(name))[1])::uuid)
  );

create function public.generate_group_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Members needed for a squad week: 80%, rounded up.
create function public.squad_need(p_members integer)
returns integer
language sql
immutable
as $$
  select greatest(1, ceil(p_members * 0.8)::integer);
$$;

-- How many members made a given week, and how many were in the group then.
-- The current week only counts goals already hit; past weeks also count
-- freezes and rest weeks.
create function public.squad_week(p_group uuid, p_week date, p_current boolean)
returns table (members integer, made integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer,
         count(*) filter (
           where w.status = 'hit' or (not p_current and w.status in ('frozen', 'rest'))
         )::integer
  from public.group_members m
  left join public.streak_weeks w on w.user_id = m.user_id and w.week_start = p_week
  where m.group_id = p_group
    and (m.joined_at at time zone 'UTC')::date <= p_week + 6;
$$;

create function public.squad_streak(p_group uuid, p_now timestamptz default now())
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz         text;
  cur_week   date;
  first_week date;
  wk         date;
  r          record;
  n          int := 0;
begin
  select coalesce(p.timezone, 'UTC') into tz from public.profiles p where p.id = auth.uid();
  tz := coalesce(tz, 'UTC');
  cur_week := public.week_of((p_now at time zone tz)::date);
  select public.week_of((g.created_at at time zone tz)::date) into first_week from public.groups g where g.id = p_group;
  wk := cur_week;

  while wk >= first_week loop
    select * into r from public.squad_week(p_group, wk, wk = cur_week);
    if r.members > 0 and r.made >= public.squad_need(r.members) then
      n := n + 1;
    elsif wk = cur_week then
      null; -- still in progress
    else
      exit;
    end if;
    wk := wk - 7;
  end loop;
  return n;
end;
$$;

-- ─── Membership ──────────────────────────────────────────────────────────────

create function public.create_group(p_name text, p_emoji text default '🔥')
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  result public.groups;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.group_members where user_id = me) >= 3 then
    raise exception 'You can be in up to 3 groups. Leave one to start another.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 30 then
    raise exception 'Give your group a name of 2 to 30 characters.' using errcode = 'P0001';
  end if;

  insert into public.groups (name, emoji, invite_code, created_by)
  values (btrim(p_name), coalesce(nullif(btrim(p_emoji), ''), '🔥'), public.generate_group_code(), me)
  returning * into result;
  insert into public.group_members (group_id, user_id, role) values (result.id, me, 'owner');
  return result;
end;
$$;

-- What an invite shows before you join.
create function public.group_preview(p_code text)
returns table (id uuid, name text, emoji text, member_count integer, is_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, g.emoji,
         (select count(*)::integer from public.group_members m where m.group_id = g.id),
         public.is_group_member(g.id, auth.uid())
  from public.groups g
  where g.invite_code = upper(btrim(p_code)) and auth.uid() is not null;
$$;

create function public.join_group(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  g  public.groups;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select * into g from public.groups where invite_code = upper(btrim(p_code));
  if g.id is null then
    raise exception 'That group code didn''t work. Check it and try again.' using errcode = 'P0002';
  end if;
  if public.is_group_member(g.id, me) then
    return g;
  end if;
  if (select count(*) from public.group_members where user_id = me) >= 3 then
    raise exception 'You can be in up to 3 groups. Leave one to join this one.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.group_members where group_id = g.id) >= 20 then
    raise exception 'That group is full (20 people).' using errcode = 'P0001';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, me);
  return g;
end;
$$;

create function public.leave_group(p_group uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.group_members where group_id = p_group and user_id = auth.uid();
$$;

create function public.remove_group_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.group_members where group_id = p_group and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the group''s owner can remove people' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'To leave your own group, use Leave group' using errcode = 'P0001';
  end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
end;
$$;

create function public.update_group(p_group uuid, p_name text, p_emoji text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.groups;
begin
  if not exists (
    select 1 from public.group_members where group_id = p_group and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the group''s owner can change it' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 30 then
    raise exception 'Give your group a name of 2 to 30 characters.' using errcode = 'P0001';
  end if;
  update public.groups
  set name = btrim(p_name), emoji = coalesce(nullif(btrim(p_emoji), ''), emoji)
  where id = p_group
  returning * into result;
  return result;
end;
$$;

-- When the owner leaves (or deletes their account), the longest-standing
-- member takes over. When the last person leaves, the group goes too.
create function public.group_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.group_members where group_id = old.group_id) then
    delete from public.groups where id = old.group_id;
  elsif not exists (select 1 from public.group_members where group_id = old.group_id and role = 'owner') then
    update public.group_members set role = 'owner'
    where (group_id, user_id) = (
      select group_id, user_id from public.group_members
      where group_id = old.group_id order by joined_at, user_id limit 1
    );
  end if;
  return null;
end;
$$;

create trigger group_members_after_delete
  after delete on public.group_members
  for each row execute function public.group_members_after_delete();

-- ─── Reading ─────────────────────────────────────────────────────────────────

create function public.my_groups(p_now timestamptz default now())
returns table (
  id uuid, name text, emoji text, invite_code text, role text,
  member_count integer, squad_streak integer, made integer, need integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, coalesce(p.timezone, 'UTC') as tz from public.profiles p where p.id = auth.uid()
  )
  select g.id, g.name, g.emoji, g.invite_code, m.role,
         w.members, public.squad_streak(g.id, p_now), w.made, public.squad_need(w.members)
  from me
  join public.group_members m on m.user_id = me.id
  join public.groups g on g.id = m.group_id
  cross join lateral public.squad_week(g.id, public.week_of((p_now at time zone me.tz)::date), true) w
  order by m.joined_at;
$$;

-- The leaderboard and squad: everyone in the group with this week's XP (in
-- your week), last week's XP (for the crown) and their days toward the goal.
create function public.group_board(p_group uuid, p_now timestamptz default now())
returns table (
  user_id uuid, name text, mascot text, avatar_url text, role text,
  xp integer, last_week_xp integer, this_week_days integer, this_week_goal integer,
  week_status text, is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, coalesce(p.timezone, 'UTC') as tz from public.profiles p where p.id = auth.uid()
  ),
  bounds as (
    select public.week_of((p_now at time zone me.tz)::date) as wk,
           (public.week_of((p_now at time zone me.tz)::date)::timestamp at time zone me.tz) as this_ts,
           ((public.week_of((p_now at time zone me.tz)::date) - 7)::timestamp at time zone me.tz) as last_ts
    from me
  )
  select pr.id,
         coalesce(nullif(split_part(pr.display_name, ' ', 1), ''), 'Someone'),
         pr.mascot::text,
         pr.avatar_url,
         m.role,
         coalesce((select sum(x.amount) from public.xp_events x
                   where x.user_id = m.user_id and x.created_at >= b.this_ts), 0)::integer,
         coalesce((select sum(x.amount) from public.xp_events x
                   where x.user_id = m.user_id and x.created_at >= b.last_ts and x.created_at < b.this_ts), 0)::integer,
         coalesce(s.this_week_days, 0)::integer,
         coalesce(s.this_week_goal, pr.weekly_goal)::integer,
         coalesce(w.status, 'in_progress'),
         pr.id = auth.uid()
  from bounds b
  join public.group_members m on m.group_id = p_group
  join public.profiles pr on pr.id = m.user_id
  left join public.streaks s on s.user_id = m.user_id
  left join public.streak_weeks w on w.user_id = m.user_id and w.week_start = b.wk
  where public.is_group_member(p_group, auth.uid())
  order by 6 desc, 2;
$$;

-- ─── Notifications ───────────────────────────────────────────────────────────

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('nudge', 'partner_workout', 'partner_request', 'partner_accepted', 'verified',
                    'streak_risk', 'comment', 'incentive', 'pep_talk', 'group'));

-- When someone hits their weekly goal: if that completes the squad week,
-- tell the whole group; if the group is one short, tell whoever's left.
create function public.notify_group_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz   text;
  wk   date;
  g    record;
  r    record;
  need integer;
  n    integer;
begin
  if new.this_week_days < new.this_week_goal
     or (tg_op = 'UPDATE' and old.this_week_days >= old.this_week_goal) then
    return null;
  end if;
  select coalesce(timezone, 'UTC') into tz from public.profiles where id = new.user_id;
  wk := public.week_of((now() at time zone tz)::date);

  for g in
    select gr.id, gr.name, gr.emoji from public.group_members m
    join public.groups gr on gr.id = m.group_id
    where m.user_id = new.user_id
  loop
    select * into r from public.squad_week(g.id, wk, true);
    -- This user's week row may not be marked 'hit' yet; count them as made.
    if not exists (
      select 1 from public.streak_weeks where user_id = new.user_id and week_start = wk and status = 'hit'
    ) then
      r.made := r.made + 1;
    end if;
    need := public.squad_need(r.members);
    if r.members < 2 then
      continue;
    end if;

    if r.made >= need then
      insert into public.group_week_notices (group_id, week_start, kind) values (g.id, wk, 'done')
      on conflict do nothing;
      get diagnostics n = row_count;
      if n > 0 then
        insert into public.notifications (user_id, kind, title, body, url)
        select m.user_id, 'group',
               g.emoji || ' ' || g.name || ' made it this week!',
               'Enough of you hit your goals to keep the squad streak alive 🔥',
               '/group/' || g.id
        from public.group_members m
        join public.profiles p on p.id = m.user_id
        where m.group_id = g.id and p.notify_groups;
      end if;
    elsif need - r.made = 1 then
      insert into public.group_week_notices (group_id, week_start, kind) values (g.id, wk, 'one_more')
      on conflict do nothing;
      get diagnostics n = row_count;
      if n > 0 then
        insert into public.notifications (user_id, kind, title, body, url)
        select m.user_id, 'group',
               g.emoji || ' ' || g.name || ' needs one more',
               'Hit your weekly goal and the squad streak lives on. Everyone''s counting on you 💪',
               '/group/' || g.id
        from public.group_members m
        join public.profiles p on p.id = m.user_id
        left join public.streak_weeks w on w.user_id = m.user_id and w.week_start = wk
        where m.group_id = g.id and p.notify_groups
          and m.user_id <> new.user_id
          and coalesce(w.status, 'in_progress') <> 'hit';
      end if;
    end if;
  end loop;
  return null;
end;
$$;

create trigger streaks_notify_groups
  after insert or update of this_week_days, this_week_goal on public.streaks
  for each row execute function public.notify_group_progress();

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.create_group(text, text) from public, anon;
revoke execute on function public.group_preview(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
revoke execute on function public.update_group(uuid, text, text) from public, anon;
revoke execute on function public.my_groups(timestamptz) from public, anon;
revoke execute on function public.group_board(uuid, timestamptz) from public, anon;
revoke execute on function public.squad_streak(uuid, timestamptz) from public, anon;
revoke execute on function public.squad_week(uuid, date, boolean) from public, anon;
revoke execute on function public.is_group_member(uuid, uuid) from public, anon;
revoke execute on function public.shares_group(uuid, uuid) from public, anon;
revoke execute on function public.generate_group_code() from public, anon, authenticated;

grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.group_preview(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.update_group(uuid, text, text) to authenticated;
grant execute on function public.my_groups(timestamptz) to authenticated;
grant execute on function public.group_board(uuid, timestamptz) to authenticated;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.shares_group(uuid, uuid) to authenticated;
