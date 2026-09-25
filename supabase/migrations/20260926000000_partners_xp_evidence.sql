-- Accountability partners, workout evidence, and Duolingo-style XP.
--
--   * Partners: mutual connections made by invite code. Accepted partners can
--     see each other's profile, streak, workouts, and evidence photos.
--   * Evidence: workouts carry a note, photos (in the private `evidence`
--     storage bucket), and the HealthKit source name (e.g. "Apple Watch").
--     Partners react, including a ✅ "verified" reaction.
--   * XP: awarded per workout, for adding photo evidence, and for hitting the
--     weekly goal. A weekly league ranks you against your partners.
--   * Friend streaks: consecutive weeks where both partners hit their goals.
--   * Nudges: a rate-limited poke to a partner.

-- ─── Profiles: invite codes ──────────────────────────────────────────────────

alter table public.profiles add column invite_code text unique;

-- 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
create function public.generate_invite_code()
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
    exit when not exists (select 1 from public.profiles where invite_code = code);
  end loop;
  return code;
end;
$$;

create function public.set_invite_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.invite_code is null then
    new.invite_code := public.generate_invite_code();
  end if;
  return new;
end;
$$;

create trigger profiles_set_invite_code
  before insert on public.profiles
  for each row execute function public.set_invite_code();

update public.profiles set invite_code = public.generate_invite_code() where invite_code is null;
alter table public.profiles alter column invite_code set not null;

-- ─── Partnerships ────────────────────────────────────────────────────────────

create table public.partnerships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  check (requester_id <> addressee_id)
);

-- One partnership per pair, whichever direction it was requested in.
create unique index partnerships_pair_idx on public.partnerships (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);

create function public.is_partner(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partnerships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

-- Pending requests also reveal the other person's name, so you know who asked.
create function public.is_connected(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partnerships
    where (requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a)
  );
$$;

-- Send a request by invite code. If they already asked you, this accepts it.
create function public.request_partner(p_code text)
returns public.partnerships
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  other  uuid;
  result public.partnerships;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id into other from public.profiles where invite_code = upper(trim(p_code));
  if other is null then
    raise exception 'No one has that invite code' using errcode = 'P0002';
  end if;
  if other = me then
    raise exception 'That is your own invite code' using errcode = '22023';
  end if;

  select * into result from public.partnerships
  where least(requester_id, addressee_id) = least(me, other)
    and greatest(requester_id, addressee_id) = greatest(me, other);

  if found then
    if result.status = 'pending' and result.addressee_id = me then
      update public.partnerships
      set status = 'accepted', accepted_at = now()
      where id = result.id
      returning * into result;
    end if;
    return result;
  end if;

  insert into public.partnerships (requester_id, addressee_id)
  values (me, other)
  returning * into result;
  return result;
end;
$$;

create function public.respond_to_partner(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.partnerships
    set status = 'accepted', accepted_at = now()
    where id = p_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.partnerships
    where id = p_id and addressee_id = auth.uid() and status = 'pending';
  end if;
  if not found then
    raise exception 'No pending request to respond to' using errcode = 'P0002';
  end if;
end;
$$;

-- ─── Workouts: evidence ──────────────────────────────────────────────────────

alter table public.workouts
  add column note        text check (char_length(note) <= 500),
  add column photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 4),
  add column source_name text;   -- HealthKit source, e.g. "Jordan's Apple Watch"

create table public.reactions (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('fire', 'strong', 'clap', 'verified')),
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id, kind)
);

-- Private bucket; files live under <user id>/<workout id>/<file>.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- ─── Nudges ──────────────────────────────────────────────────────────────────

create table public.nudges (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);

create index nudges_to_idx on public.nudges (to_id, created_at desc);

create function public.nudge_partner(p_partner uuid)
returns public.nudges
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.nudges;
begin
  if not public.is_partner(auth.uid(), p_partner) then
    raise exception 'You can only nudge your partners' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.nudges
    where from_id = auth.uid() and to_id = p_partner and created_at > now() - interval '12 hours'
  ) then
    raise exception 'You already nudged them recently' using errcode = 'P0001';
  end if;
  insert into public.nudges (from_id, to_id) values (auth.uid(), p_partner) returning * into result;
  return result;
end;
$$;

-- ─── XP ──────────────────────────────────────────────────────────────────────

create table public.xp_events (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('workout', 'evidence', 'week_goal')),
  ref        text not null,      -- workout id, or week_start for week_goal
  amount     integer not null check (amount >= 0),
  created_at timestamptz not null default now(),  -- when it was earned (league week)
  awarded_at timestamptz not null default now(),  -- when it appeared (celebrations)
  primary key (user_id, kind, ref)
);

create index xp_events_user_created_idx on public.xp_events (user_id, created_at desc);

-- 10 XP for showing up, +1 per 2 minutes up to an hour. Under 5 minutes earns nothing.
create function public.workout_xp(p_duration_s integer)
returns integer
language sql
immutable
as $$
  select case
    when p_duration_s < 300 then 0
    else 10 + least(p_duration_s / 60, 60) / 2
  end;
$$;

-- Workout triggers now also maintain XP.
create or replace function public.workouts_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.xp_events x
    using old_rows o
    where x.user_id = o.user_id and x.kind in ('workout', 'evidence') and x.ref = o.id::text;

    for uid in select distinct user_id from old_rows loop
      perform public.recompute_streak(uid);
    end loop;
  else
    insert into public.xp_events (user_id, kind, ref, amount, created_at)
    select n.user_id, 'workout', n.id::text, public.workout_xp(n.duration_s), n.ended_at
    from new_rows n
    where public.workout_xp(n.duration_s) > 0
    on conflict (user_id, kind, ref) do update set amount = excluded.amount;

    insert into public.xp_events (user_id, kind, ref, amount)
    select n.user_id, 'evidence', n.id::text, 5
    from new_rows n
    where cardinality(n.photo_paths) > 0
    on conflict (user_id, kind, ref) do nothing;

    for uid in select distinct user_id from new_rows loop
      perform public.recompute_streak(uid);
    end loop;
  end if;
  return null;
end;
$$;

-- Hitting the weekly goal is worth 50 XP. Awarded (and revoked) by the streak engine.
create function public.sync_week_goal_xp(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  -- Dated to the end of the week it was earned (or now, for the current week)
  -- so backfilled history doesn't count toward this week's league.
  insert into public.xp_events (user_id, kind, ref, amount, created_at)
  select w.user_id, 'week_goal', w.week_start::text, 50,
         least(now(), ((w.week_start + 7)::timestamp at time zone p.timezone) - interval '1 second')
  from public.streak_weeks w
  join public.profiles p on p.id = w.user_id
  where w.user_id = p_user and w.status = 'hit'
  on conflict (user_id, kind, ref) do nothing;

  delete from public.xp_events x
  where x.user_id = p_user
    and x.kind = 'week_goal'
    and not exists (
      select 1 from public.streak_weeks w
      where w.user_id = p_user and w.week_start::text = x.ref and w.status = 'hit'
    );
$$;

revoke execute on function public.sync_week_goal_xp(uuid) from public, anon, authenticated;

-- Wrap the streak engine so every recompute also settles week-goal XP.
alter function public.recompute_streak(uuid, timestamptz) rename to recompute_streak_core;

create function public.recompute_streak(p_user uuid, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_streak_core(p_user, p_now);
  perform public.sync_week_goal_xp(p_user);
end;
$$;

revoke execute on function public.recompute_streak_core(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.recompute_streak(uuid, timestamptz) from public, anon, authenticated;

-- ─── Friend streaks, partner list, league ────────────────────────────────────

-- Consecutive weeks (since the partnership began) in which both people hit
-- their goal. Freezes on either side hold the streak without adding to it,
-- and the current week only counts once both have hit.
create function public.friend_streak(a uuid, b uuid, since timestamptz, p_now timestamptz default now())
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
  sa         text;
  sb         text;
  n          int := 0;
begin
  select timezone into tz from public.profiles where id = a;
  cur_week   := date_trunc('week', p_now at time zone tz)::date;
  first_week := date_trunc('week', since at time zone tz)::date;
  wk := cur_week;

  while wk >= first_week loop
    select status into sa from public.streak_weeks where user_id = a and week_start = wk;
    select status into sb from public.streak_weeks where user_id = b and week_start = wk;

    if sa = 'hit' and sb = 'hit' then
      n := n + 1;
    elsif wk = cur_week then
      null; -- still in progress
    elsif sa in ('hit', 'frozen') and sb in ('hit', 'frozen') then
      null; -- protected by a freeze
    else
      exit;
    end if;
    wk := wk - 7;
  end loop;

  return n;
end;
$$;

revoke execute on function public.friend_streak(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;

create function public.my_partners()
returns table (
  partnership_id  uuid,
  partner_id      uuid,
  display_name    text,
  avatar_url      text,
  status          text,
  incoming        boolean,
  current_weeks   integer,
  this_week_days  smallint,
  this_week_goal  smallint,
  friend_streak   integer,
  last_nudged_at  timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  pid uuid;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Bring everyone's streak up to date so a partner who hasn't opened the app
  -- since the week rolled over doesn't show a stale week.
  perform public.recompute_streak(me);
  for pid in
    select case when p.requester_id = me then p.addressee_id else p.requester_id end
    from public.partnerships p
    where p.status = 'accepted' and me in (p.requester_id, p.addressee_id)
  loop
    perform public.recompute_streak(pid);
  end loop;

  return query
  select
    p.id,
    o.id,
    o.display_name,
    o.avatar_url,
    p.status,
    p.status = 'pending' and p.addressee_id = me,
    coalesce(s.current_weeks, 0),
    coalesce(s.this_week_days, 0::smallint),
    coalesce(s.this_week_goal, o.weekly_goal),
    case when p.status = 'accepted'
      then public.friend_streak(me, o.id, p.accepted_at) else 0 end,
    (select max(n.created_at) from public.nudges n where n.from_id = me and n.to_id = o.id)
  from public.partnerships p
  join public.profiles o
    on o.id = case when p.requester_id = me then p.addressee_id else p.requester_id end
  left join public.streaks s
    on s.user_id = o.id and p.status = 'accepted'
  where me in (p.requester_id, p.addressee_id)
  order by p.status = 'pending' desc, o.display_name;
end;
$$;

revoke execute on function public.my_partners() from public, anon;
grant execute on function public.my_partners() to authenticated;

-- This week's XP for you and your partners (weeks in your timezone).
create function public.weekly_league(p_now timestamptz default now())
returns table (user_id uuid, display_name text, avatar_url text, xp integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select id, timezone from public.profiles where id = auth.uid()
  ),
  week_start as (
    select (date_trunc('week', p_now at time zone me.timezone) at time zone me.timezone) as ts from me
  ),
  members as (
    select id from me
    union
    select case when p.requester_id = me.id then p.addressee_id else p.requester_id end
    from public.partnerships p, me
    where p.status = 'accepted' and me.id in (p.requester_id, p.addressee_id)
  )
  select pr.id, pr.display_name, pr.avatar_url,
         coalesce(sum(x.amount), 0)::integer,
         pr.id = auth.uid()
  from members m
  join public.profiles pr on pr.id = m.id
  left join public.xp_events x
    on x.user_id = m.id and x.created_at >= (select ts from week_start)
  group by pr.id, pr.display_name, pr.avatar_url
  order by 4 desc, pr.display_name;
$$;

revoke execute on function public.weekly_league(timestamptz) from public, anon;
grant execute on function public.weekly_league(timestamptz) to authenticated;

revoke execute on function public.request_partner(text) from public, anon;
grant execute on function public.request_partner(text) to authenticated;
revoke execute on function public.respond_to_partner(uuid, boolean) from public, anon;
grant execute on function public.respond_to_partner(uuid, boolean) to authenticated;
revoke execute on function public.nudge_partner(uuid) from public, anon;
grant execute on function public.nudge_partner(uuid) to authenticated;

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.partnerships enable row level security;
alter table public.reactions    enable row level security;
alter table public.nudges       enable row level security;
alter table public.xp_events    enable row level security;

create policy "Read connected profiles" on public.profiles
  for select to authenticated using (public.is_connected((select auth.uid()), id));

create policy "Read own partnerships" on public.partnerships
  for select to authenticated using ((select auth.uid()) in (requester_id, addressee_id));
create policy "Remove own partnerships" on public.partnerships
  for delete to authenticated using ((select auth.uid()) in (requester_id, addressee_id));

create policy "Read partner workouts" on public.workouts
  for select to authenticated using (public.is_partner((select auth.uid()), user_id));
create policy "Read partner streaks" on public.streaks
  for select to authenticated using (public.is_partner((select auth.uid()), user_id));
create policy "Read partner streak weeks" on public.streak_weeks
  for select to authenticated using (public.is_partner((select auth.uid()), user_id));

-- Reactions are visible to anyone who can see the workout (owner + partners).
create policy "Read reactions on visible workouts" on public.reactions
  for select to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id));
create policy "React to visible workouts" on public.reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id
        -- You can't verify your own workout.
        and (kind <> 'verified' or w.user_id <> (select auth.uid()))
    )
  );
create policy "Remove own reactions" on public.reactions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Read own nudges" on public.nudges
  for select to authenticated using ((select auth.uid()) in (from_id, to_id));
create policy "Mark received nudges seen" on public.nudges
  for update to authenticated
  using (to_id = (select auth.uid())) with check (to_id = (select auth.uid()));

create policy "Read own xp" on public.xp_events
  for select to authenticated using (user_id = (select auth.uid()));

-- Evidence photos: upload/delete under your own folder; partners can view.
create policy "Upload own evidence" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own evidence" on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "View own and partner evidence" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_partner((select auth.uid()), ((storage.foldername(name))[1])::uuid)
    )
  );

-- Newly created tables need grants in environments without default privileges.
grant select, insert, delete on public.reactions to authenticated;
grant select, update on public.nudges to authenticated;
grant select on public.xp_events to authenticated;
grant select, delete on public.partnerships to authenticated;
