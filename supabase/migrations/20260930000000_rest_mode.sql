-- Rest mode: pause the streak during illness, injury, or travel.
--
-- While resting, weeks that aren't hit are marked 'rest': they neither add to
-- nor break the streak (like a freeze, but without spending one), friend
-- streaks hold, and streak-at-risk reminders stop. A workout during rest still
-- counts normally. Periods are kept as history so the streak can always be
-- recomputed from scratch.

create table public.rest_periods (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on   date,                      -- null while still resting
  check (ends_on is null or ends_on >= starts_on)
);

create unique index rest_periods_one_open_idx on public.rest_periods (user_id) where ends_on is null;

-- Mirrors the open rest period, so the app can read it from the profile.
alter table public.profiles add column resting_since timestamptz;

alter table public.streak_weeks
  drop constraint streak_weeks_status_check,
  add constraint streak_weeks_status_check
    check (status in ('hit', 'frozen', 'missed', 'in_progress', 'rest'));

create function public.set_rest_mode(p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me    uuid := auth.uid();
  today date;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select (now() at time zone timezone)::date into today from public.profiles where id = me;

  if p_on then
    insert into public.rest_periods (user_id, starts_on)
    select me, today
    where not exists (select 1 from public.rest_periods where user_id = me and ends_on is null);
    update public.profiles set resting_since = coalesce(resting_since, now()) where id = me;
  else
    update public.rest_periods set ends_on = greatest(today, starts_on)
    where user_id = me and ends_on is null;
    update public.profiles set resting_since = null where id = me;
  end if;

  perform public.recompute_streak(me);
end;
$$;

revoke execute on function public.set_rest_mode(boolean) from public, anon;
grant execute on function public.set_rest_mode(boolean) to authenticated;

alter table public.rest_periods enable row level security;
create policy "Read own rest periods" on public.rest_periods
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.rest_periods to authenticated;

-- ─── Streak engine, friend streaks, reminders: now rest-aware ───────────────

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
begin
  select * into prof from public.profiles where id = p_user;
  if not found then
    return;
  end if;

  cur_week := date_trunc('week', p_now at time zone prof.timezone)::date;

  for rec in
    with active_days as (
      select distinct (w.started_at at time zone prof.timezone)::date as day
      from public.workouts w
      where w.user_id = p_user
        and w.duration_s >= prof.min_workout_minutes * 60
    ),
    per_week as (
      select date_trunc('week', day)::date as week_start, count(*)::smallint as days
      from active_days
      group by 1
    ),
    bounds as (
      select min(week_start) as first_week from per_week
    )
    select gs::date as week_start,
           coalesce(pw.days, 0)::smallint as days,
           sw.goal as saved_goal,
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
    order by 1
  loop
    first_week := coalesce(first_week, rec.week_start);

    -- Past weeks keep the goal that applied at the time; the current week
    -- always follows the profile so goal changes take effect immediately.
    week_goal := case
      when rec.week_start = cur_week then prof.weekly_goal
      else coalesce(rec.saved_goal, prof.weekly_goal)
    end;

    if rec.days >= week_goal then
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
    days_left := 8 - extract(isodow from local_ts)::int;   -- including today
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
