-- Weeks run Sunday to Saturday (S M T W T F S), for everyone. Until now they were
-- ISO weeks (Monday to Sunday) via date_trunc('week', ...). Everything that cuts
-- time into weeks now goes through public.week_of, and stored weeks move back a day.

-- The Sunday that starts the week containing d.
create function public.week_of(d date)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select d - extract(dow from d)::int;
$$;

-- Weeks that were hit before the switch stay hit, even if a Sunday workout now
-- belongs to the next week, so nobody loses a streak to the calendar change. Each
-- keeps the goal it was hit with: raising your goal still re-checks it.
create table public.legacy_week_hits (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,           -- the Sunday week that took over the old Monday week
  goal       smallint not null,
  primary key (user_id, week_start)
);

alter table public.legacy_week_hits enable row level security;

create policy "Users can read their own legacy week hits"
  on public.legacy_week_hits for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ─── Streak engine ──────────────────────────────────────────────────────────

create or replace function public.recompute_streak_core(p_user uuid, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hits_per_freeze constant int := 4;
  max_freezes     constant int := 2;

  prof         public.profiles%rowtype;
  cur_week     date;
  rec          record;
  week_goal    smallint;
  week_status  text;
  streak       int := 0;
  longest      int := 0;
  freezes      int := 0;
  hits_to_next int := 0;
  first_week   date;
  cur_days     smallint := 0;
  joined_week  date;
begin
  select * into prof from public.profiles where id = p_user;
  if not found then
    return;
  end if;

  cur_week := public.week_of((p_now at time zone prof.timezone)::date);
  -- Weeks before you joined come from your Health history; they follow your current
  -- goal, so picking a realistic goal on day one counts your past too.
  joined_week := public.week_of((prof.created_at at time zone prof.timezone)::date);

  for rec in
    with active_days as (
      select distinct (w.started_at at time zone prof.timezone)::date as day
      from public.workouts w
      where w.user_id = p_user
        and w.duration_s >= prof.min_workout_minutes * 60
    ),
    per_week as (
      select public.week_of(day) as week_start, count(*)::smallint as days
      from active_days
      group by 1
    ),
    bounds as (
      select min(week_start) as first_week from per_week
    )
    select gs::date as week_start,
           coalesce(pw.days, 0)::smallint as days,
           sw.goal as saved_goal,
           lh.goal as legacy_goal,
           exists (
             select 1 from public.rest_periods r
             where r.user_id = p_user
               and r.starts_on <= gs::date + 6
               and coalesce(r.ends_on, 'infinity'::date) >= gs::date
           ) as is_rest
    from bounds
    cross join generate_series(bounds.first_week, cur_week, interval '1 week') as gs
    left join per_week pw on pw.week_start = gs::date
    left join public.streak_weeks sw on sw.user_id = p_user and sw.week_start = gs::date
    left join public.legacy_week_hits lh on lh.user_id = p_user and lh.week_start = gs::date
    order by 1
  loop
    first_week := coalesce(first_week, rec.week_start);

    -- Past weeks since you joined keep the goal that applied at the time, so
    -- lowering your goal can't rewrite them. The current week, and weeks from
    -- before you joined, follow the profile so goal changes take effect.
    week_goal := case
      when rec.week_start = cur_week or rec.week_start < joined_week then prof.weekly_goal
      else coalesce(rec.saved_goal, prof.weekly_goal)
    end;

    if rec.days >= week_goal or rec.legacy_goal >= week_goal then
      week_status  := 'hit';
      streak       := streak + 1;
      hits_to_next := hits_to_next + 1;
      if hits_to_next >= hits_per_freeze then
        hits_to_next := 0;
        freezes := least(freezes + 1, max_freezes);
      end if;
    elsif rec.is_rest then
      -- Rest mode (illness, injury, travel): the week neither adds to nor
      -- breaks the streak, and no freeze is spent.
      week_status := 'rest';
    elsif rec.week_start = cur_week then
      week_status := 'in_progress';
    elsif freezes > 0 and streak > 0 then
      week_status := 'frozen';
      freezes     := freezes - 1;
    else
      week_status  := 'missed';
      streak       := 0;
      hits_to_next := 0;
    end if;

    longest := greatest(longest, streak);

    if rec.week_start = cur_week then
      cur_days := rec.days;
    end if;

    insert into public.streak_weeks (user_id, week_start, active_days, goal, status)
    values (p_user, rec.week_start, rec.days, week_goal, week_status)
    on conflict (user_id, week_start) do update
      set active_days = excluded.active_days,
          goal        = excluded.goal,
          status      = excluded.status;
  end loop;

  -- Drop weeks that no longer fall in range (e.g. the earliest workout was deleted).
  delete from public.streak_weeks
  where user_id = p_user
    and (first_week is null or week_start < first_week or week_start > cur_week);

  insert into public.streaks as s (
    user_id, current_weeks, longest_weeks, freezes_banked,
    this_week_start, this_week_days, this_week_goal, updated_at
  )
  values (
    p_user, streak, longest, freezes,
    cur_week, cur_days, prof.weekly_goal, p_now
  )
  on conflict (user_id) do update
    set current_weeks   = excluded.current_weeks,
        longest_weeks   = excluded.longest_weeks,
        freezes_banked  = excluded.freezes_banked,
        this_week_start = excluded.this_week_start,
        this_week_days  = excluded.this_week_days,
        this_week_goal  = excluded.this_week_goal,
        updated_at      = excluded.updated_at;
end;
$$;

create or replace function public.friend_streak(a uuid, b uuid, since timestamptz, p_now timestamptz default now())
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
  cur_week   := public.week_of((p_now at time zone tz)::date);
  first_week := public.week_of((since at time zone tz)::date);
  wk := cur_week;

  while wk >= first_week loop
    select status into sa from public.streak_weeks where user_id = a and week_start = wk;
    select status into sb from public.streak_weeks where user_id = b and week_start = wk;

    if sa = 'hit' and sb = 'hit' then
      n := n + 1;
    elsif wk = cur_week then
      null; -- still in progress
    elsif sa in ('hit', 'frozen', 'rest') and sb in ('hit', 'frozen', 'rest') then
      null; -- protected by a freeze or rest mode
    else
      exit;
    end if;
    wk := wk - 7;
  end loop;

  return n;
end;
$$;

-- ─── League, reminders, incentives ──────────────────────────────────────────

create or replace function public.weekly_league(p_now timestamptz default now())
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
    select (public.week_of((p_now at time zone me.timezone)::date)::timestamp at time zone me.timezone) as ts from me
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

create or replace function public.send_streak_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reminder_hour constant int := 18;

  r         record;
  s         public.streaks;
  local_ts  timestamp;
  days_left int;
  needed    int;
  title     text;
  body      text;
  sent      int := 0;
begin
  for r in
    select p.id, p.timezone
    from public.profiles p
    where p.notify_streak_reminders
      and p.onboarded_at is not null
      and p.resting_since is null
      and extract(hour from p_now at time zone p.timezone) = reminder_hour
  loop
    -- The stored streak may predate this week's workouts or the week rollover.
    perform public.recompute_streak(r.id, p_now);
    select * into s from public.streaks where user_id = r.id;
    if not found or s.current_weeks = 0 then
      continue;
    end if;

    local_ts  := p_now at time zone r.timezone;
    days_left := 7 - extract(dow from local_ts)::int;   -- including today; Saturday is the last day
    needed    := s.this_week_goal - s.this_week_days;

    -- Done, comfortably on track, or already out of reach (a freeze covers
    -- it if they have one; nagging wouldn't help).
    if needed <= 0 or needed > days_left or days_left - needed > 1 then
      continue;
    end if;

    if days_left = 1 then
      title := format('Last chance to keep your %s-week streak 🔥', s.current_weeks);
      body  := 'One workout today keeps it alive.';
    elsif needed = days_left then
      title := format('Your %s-week streak is on the line 🔥', s.current_weeks);
      body  := format('You need a workout every day left this week: %s to go.', needed);
    else
      title := format('Your %s-week streak is at risk 🔥', s.current_weeks);
      body  := format('%s more workout %s needed with %s days left this week.',
                      needed, case when needed = 1 then 'day' else 'days' end, days_left);
    end if;
    if s.freezes_banked > 0 then
      body := body || ' (A freeze has your back if needed.)';
    end if;

    insert into public.notifications (user_id, kind, title, body, url, dedupe_key)
    values (r.id, 'streak_risk', title, body, '/', 'streak-risk:' || local_ts::date)
    on conflict do nothing;
    if found then
      sent := sent + 1;
    end if;
  end loop;

  return sent;
end;
$$;

create or replace function public.offer_incentive(
  p_to            uuid,
  p_goal_kind     text,
  p_goal_target   integer,
  p_weeks         integer,
  p_reward        text,
  p_reward_emoji  text default '🎁',
  p_activity_type text default null,
  p_verified_only boolean default false,
  p_notes         text default null
)
returns public.incentives
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  tz text;
  first_day date;
  i public.incentives;
  max_target integer;
begin
  if not public.is_partner(me, p_to) then
    raise exception 'You can only offer incentives to your partners' using errcode = '42501';
  end if;
  if p_weeks is null or p_weeks not between 1 and 4 then
    raise exception 'Incentives last 1 to 4 weeks' using errcode = '22023';
  end if;
  max_target := case p_goal_kind
    when 'workout_days' then 7 * p_weeks
    when 'active_minutes' then 1500 * p_weeks
    when 'workouts' then 14 * p_weeks
    when 'streak_weeks' then 104
  end;
  if max_target is null then
    raise exception 'Unknown goal' using errcode = '22023';
  end if;
  if p_goal_target is null or p_goal_target not between 1 and max_target then
    raise exception 'Pick a goal between 1 and %', max_target using errcode = '22023';
  end if;
  if exists (
    select 1 from public.incentives
    where from_id = me and to_id = p_to and status in ('offered', 'active')
  ) then
    raise exception 'You already have an incentive going with them' using errcode = 'P0001';
  end if;

  -- Whole weeks in the recipient's timezone, starting this Sunday.
  select timezone into tz from public.profiles where id = p_to;
  first_day := public.week_of((now() at time zone tz)::date);

  insert into public.incentives (
    from_id, to_id, goal_kind, goal_target, activity_type, weeks, starts_at, ends_at,
    reward, reward_emoji, verified_only, notes
  ) values (
    me, p_to, p_goal_kind, p_goal_target,
    case when p_goal_kind = 'workouts' then nullif(p_activity_type, '') end,
    p_weeks,
    first_day::timestamp at time zone tz,
    (first_day + 7 * p_weeks)::timestamp at time zone tz,
    btrim(p_reward), coalesce(nullif(btrim(p_reward_emoji), ''), '🎁'), coalesce(p_verified_only, false),
    nullif(btrim(p_notes), '')
  )
  returning * into i;

  perform public.notify_incentive(p_to,
    public.first_name(me) || ' offered you an incentive 🎁',
    public.incentive_goal_text(i) || ' → ' || i.reward_emoji || ' ' || i.reward
      || coalesce(' · ' || left(i.notes, 80), ''), i.id);
  return i;
end;
$$;

-- ─── Move existing weeks ────────────────────────────────────────────────────

-- Each stored Monday week becomes the Sunday week that starts the day before, keeping
-- the goal it was saved with. Workouts are then regrouped by the recompute below
-- (Sunday workouts move into the following week); past weeks that were hit stay hit.
insert into public.legacy_week_hits (user_id, week_start, goal)
select w.user_id, w.week_start - 1, w.goal
from public.streak_weeks w
join public.streaks s on s.user_id = w.user_id
where w.status = 'hit'
  and w.week_start < s.this_week_start
  and extract(isodow from w.week_start) = 1;

update public.streak_weeks set week_start = week_start - 1
where extract(isodow from week_start) = 1;

-- "Hit your goal" XP follows its week, dated to the new week's last second (Saturday
-- night) so it doesn't spill into the following week's league.
update public.xp_events x
set ref = (x.ref::date - 1)::text,
    created_at = least(
      x.created_at,
      ((x.ref::date + 6)::timestamp at time zone p.timezone) - interval '1 second'
    )
from public.profiles p
where p.id = x.user_id
  and x.kind = 'week_goal'
  and extract(isodow from x.ref::date) = 1;

select public.recompute_streak(id) from public.profiles;
