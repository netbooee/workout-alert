-- Public leagues, Duolingo-style. People opt in; each week everyone who earns
-- XP is placed in a group of up to 20 at their tier (1 Spark … 5 Inferno),
-- matched with people in nearby time zones so the week ends at about the same
-- time. When the week ends the top of each group moves up a tier and the bottom
-- moves down. Strangers only ever see a name (or nickname), buddy, XP and tier.
--
-- Fairness: in public leagues a hand-logged workout without a photo counts for
-- half its XP. Partner leagues are unchanged.
--
-- Keep tier names and zone sizes in sync with src/lib/leagues.ts.

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.league_players (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  opted_in   boolean not null default true,
  tier       smallint not null default 1 check (tier between 1 and 5),
  nickname   text check (nickname is null or char_length(btrim(nickname)) between 2 and 20),
  updated_at timestamptz not null default now()
);

create table public.league_cohorts (
  id         uuid primary key default gen_random_uuid(),
  week_start date not null,
  tier       smallint not null check (tier between 1 and 5),
  region     smallint not null,
  closed_at  timestamptz,
  created_at timestamptz not null default now()
);

create index league_cohorts_open_idx on public.league_cohorts (week_start, tier, region) where closed_at is null;

create table public.league_members (
  cohort_id   uuid not null references public.league_cohorts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  week_start  date not null,
  joined_at   timestamptz not null default now(),
  final_xp    integer,
  final_rank  integer,
  result      text check (result in ('up', 'stay', 'down')),
  result_seen boolean not null default false,
  primary key (cohort_id, user_id),
  unique (user_id, week_start)
);

create table public.league_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  cohort_id   uuid references public.league_cohorts (id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

alter table public.league_players enable row level security;
alter table public.league_cohorts enable row level security;
alter table public.league_members enable row level security;
alter table public.league_reports enable row level security;

-- You can read your own settings; everything else goes through the functions
-- below, so the other tables aren't exposed to clients at all.
revoke all on public.league_players, public.league_cohorts, public.league_members, public.league_reports
  from anon, authenticated;
create policy "Read own league settings" on public.league_players
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.league_players to authenticated;

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- Time zone band: 0 the Americas, 1 Europe and Africa, 2–3 Asia and the Pacific.
create function public.league_region(p_timezone text)
returns smallint
language sql
stable
set search_path = ''
as $$
  select least(greatest(floor((extract(epoch from (now() at time zone p_timezone) - (now() at time zone 'UTC')) / 3600 + 12) / 8), 0), 3)::smallint;
$$;

-- The Sunday that starts a user's current week, in their time zone.
create function public.league_week(p_user uuid, p_now timestamptz default now())
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select public.week_of((p_now at time zone p.timezone)::date) from public.profiles p where p.id = p_user;
$$;

-- A user's XP for one league week, from their own Sunday midnight. Hand-logged
-- workouts without a photo count half.
create function public.league_xp(p_user uuid, p_week date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case
      when x.kind = 'workout' and w.source = 'manual' and cardinality(w.photo_paths) = 0 then x.amount / 2
      else x.amount
    end), 0)::integer
  from public.profiles p
  join public.xp_events x on x.user_id = p.id
  left join public.workouts w on x.kind = 'workout' and w.id::text = x.ref
  where p.id = p_user
    and x.created_at >= (p_week::timestamp at time zone p.timezone)
    and x.created_at < ((p_week + 7)::timestamp at time zone p.timezone);
$$;

-- How many move up and down in a group of n (up to 5 up, 3 down; small groups fewer).
create function public.league_promote_count(n integer)
returns integer language sql immutable set search_path = '' as $$ select least(5, ceil(n * 0.25))::integer; $$;
create function public.league_demote_count(n integer)
returns integer language sql immutable set search_path = '' as $$ select least(3, floor(n * 0.15))::integer; $$;

-- ─── Joining ─────────────────────────────────────────────────────────────────

-- Puts an opted-in user with XP this week into a group at their tier, filling
-- the oldest open group in their time zone band first.
create function public.league_join(p_user uuid, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week   date;
  v_tier   smallint;
  v_region smallint;
  v_cohort uuid;
begin
  select lp.tier, public.league_region(p.timezone) into v_tier, v_region
  from public.league_players lp join public.profiles p on p.id = lp.user_id
  where lp.user_id = p_user and lp.opted_in;
  if not found then
    return;
  end if;

  v_week := public.league_week(p_user, p_now);
  if exists (select 1 from public.league_members where user_id = p_user and week_start = v_week) then
    return;
  end if;
  if public.league_xp(p_user, v_week) <= 0 then
    return;
  end if;

  -- One joiner at a time per group key, so groups never pass 20.
  perform pg_advisory_xact_lock(hashtext(format('league:%s:%s:%s', v_week, v_tier, v_region)));

  select c.id into v_cohort
  from public.league_cohorts c
  where c.week_start = v_week and c.tier = v_tier and c.region = v_region and c.closed_at is null
    and (select count(*) from public.league_members m where m.cohort_id = c.id) < 20
  order by c.created_at
  limit 1;

  if v_cohort is null then
    insert into public.league_cohorts (week_start, tier, region)
    values (v_week, v_tier, v_region)
    returning id into v_cohort;
  end if;

  insert into public.league_members (cohort_id, user_id, week_start)
  values (v_cohort, p_user, v_week)
  on conflict do nothing;
end;
$$;

-- Earning XP is what puts you in this week's group.
create function public.xp_events_league_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.league_join(new.user_id);
  return null;
end;
$$;

create trigger xp_events_league_join
  after insert on public.xp_events
  for each row execute function public.xp_events_league_join();

-- ─── Client API ──────────────────────────────────────────────────────────────

-- Turn public leagues on or off and set an optional nickname (null shows your first name).
create function public.set_public_league(p_on boolean, p_nickname text default null)
returns public.league_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  result public.league_players;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  insert into public.league_players (user_id, opted_in, nickname)
  values (me, p_on, nullif(btrim(p_nickname), ''))
  on conflict (user_id) do update
    set opted_in = excluded.opted_in, nickname = excluded.nickname, updated_at = now()
  returning * into result;

  if p_on then
    perform public.league_join(me);
  else
    -- Leaving takes you out of this week's group straight away.
    delete from public.league_members m
    using public.league_cohorts c
    where m.cohort_id = c.id and m.user_id = me and c.closed_at is null;
  end if;
  return result;
end;
$$;

-- Your group this week: everyone's name, buddy, XP and place. Strangers are
-- identified by a key that is only stable within the group.
create function public.my_public_league(p_now timestamptz default now())
returns table (
  member_key text,
  name text,
  mascot text,
  xp integer,
  rank integer,
  is_me boolean,
  tier smallint,
  week_start date,
  group_size integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select m.cohort_id, c.tier, c.week_start
    from public.league_members m
    join public.league_cohorts c on c.id = m.cohort_id
    where m.user_id = auth.uid() and c.closed_at is null
      and m.week_start = public.league_week(auth.uid(), p_now)
  ),
  rows as (
    select m.user_id,
           coalesce(lp.nickname, split_part(coalesce(p.display_name, 'Player'), ' ', 1)) as name,
           p.mascot::text as mascot,
           public.league_xp(m.user_id, m.week_start) as xp,
           m.joined_at
    from mine
    join public.league_members m on m.cohort_id = mine.cohort_id
    join public.profiles p on p.id = m.user_id
    left join public.league_players lp on lp.user_id = m.user_id
  )
  select md5(r.user_id::text || mine.cohort_id::text),
         r.name,
         r.mascot,
         r.xp,
         (row_number() over (order by r.xp desc, r.joined_at))::integer,
         r.user_id = auth.uid(),
         mine.tier,
         mine.week_start,
         (count(*) over ())::integer
  from rows r, mine
  order by 5;
$$;

-- Your most recent finished week you haven't seen yet: where you placed and
-- whether you moved up, stayed, or moved down.
create function public.my_league_result()
returns table (week_start date, final_rank integer, final_xp integer, result text, tier smallint, group_size integer)
language sql
stable
security definer
set search_path = ''
as $$
  select m.week_start, m.final_rank, m.final_xp, m.result, lp.tier,
         (select count(*) from public.league_members o where o.cohort_id = m.cohort_id)::integer
  from public.league_members m
  join public.league_cohorts c on c.id = m.cohort_id
  join public.league_players lp on lp.user_id = m.user_id
  where m.user_id = auth.uid() and c.closed_at is not null and not m.result_seen
  order by m.week_start desc
  limit 1;
$$;

create function public.mark_league_result_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.league_members set result_seen = true
  where user_id = auth.uid() and result is not null and not result_seen;
$$;

-- Report someone in your group (by their key from my_public_league).
create function public.report_league_member(p_member_key text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cohort uuid;
  v_user   uuid;
begin
  select m.cohort_id into v_cohort
  from public.league_members m join public.league_cohorts c on c.id = m.cohort_id
  where m.user_id = auth.uid() and c.closed_at is null
  order by m.week_start desc limit 1;

  select m.user_id into v_user
  from public.league_members m
  where m.cohort_id = v_cohort and md5(m.user_id::text || v_cohort::text) = p_member_key;
  if v_user is null or v_user = auth.uid() then
    raise exception 'Player not found' using errcode = 'P0002';
  end if;

  insert into public.league_reports (reporter_id, reported_id, cohort_id, reason)
  values (auth.uid(), v_user, v_cohort, left(p_reason, 500));
end;
$$;

-- ─── Closing the week ────────────────────────────────────────────────────────

-- Closes each group once its week is over everywhere (Sunday midnight plus 14
-- hours of time zones), ranks it, and moves people between tiers. Anyone with
-- no XP never moves up; in tier 2 and above they move down.
create function public.close_league_weeks(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c       record;
  n       integer;
  up      integer;
  down    integer;
  closed  integer := 0;
begin
  for c in
    select * from public.league_cohorts
    where closed_at is null and ((week_start + 7)::timestamp at time zone 'UTC') + interval '14 hours' <= p_now
    for update skip locked
  loop
    update public.league_members m
    set final_xp = public.league_xp(m.user_id, m.week_start)
    where m.cohort_id = c.id;

    with ranked as (
      select user_id, row_number() over (order by final_xp desc, joined_at) as r
      from public.league_members where cohort_id = c.id
    )
    update public.league_members m set final_rank = ranked.r
    from ranked where m.cohort_id = c.id and m.user_id = ranked.user_id;

    select count(*) into n from public.league_members where cohort_id = c.id;
    up := public.league_promote_count(n);
    down := public.league_demote_count(n);

    update public.league_members m
    set result = case
      when m.final_xp > 0 and m.final_rank <= up and c.tier < 5 then 'up'
      when c.tier > 1 and (m.final_xp = 0 or m.final_rank > n - down) then 'down'
      else 'stay'
    end
    where m.cohort_id = c.id;

    update public.league_players lp
    set tier = lp.tier + case m.result when 'up' then 1 when 'down' then -1 else 0 end,
        updated_at = p_now
    from public.league_members m
    where m.cohort_id = c.id and m.user_id = lp.user_id and m.result <> 'stay';

    update public.league_cohorts set closed_at = p_now where id = c.id;
    closed := closed + 1;
  end loop;
  return closed;
end;
$$;

select cron.schedule('league-close', '17 * * * *', $$select public.close_league_weeks()$$);

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.league_week(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.league_xp(uuid, date) from public, anon, authenticated;
revoke execute on function public.league_join(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.close_league_weeks(timestamptz) from public, anon, authenticated;

revoke execute on function public.set_public_league(boolean, text) from public, anon;
revoke execute on function public.my_public_league(timestamptz) from public, anon;
revoke execute on function public.my_league_result() from public, anon;
revoke execute on function public.mark_league_result_seen() from public, anon;
revoke execute on function public.report_league_member(text, text) from public, anon;
grant execute on function public.set_public_league(boolean, text) to authenticated;
grant execute on function public.my_public_league(timestamptz) to authenticated;
grant execute on function public.my_league_result() to authenticated;
grant execute on function public.mark_league_result_seen() to authenticated;
grant execute on function public.report_league_member(text, text) to authenticated;
