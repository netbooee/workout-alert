-- Initial schema: profiles, health data, and the weekly streak engine.
--
-- Streak rules (all in the user's own timezone, weeks run Monday–Sunday):
--   * An "active day" is a day with at least one workout lasting
--     >= profiles.min_workout_minutes.
--   * A week is "hit" when active days >= that week's goal.
--   * The streak is the number of consecutive hit weeks. The current week
--     never breaks the streak while it is still in progress.
--   * Every 4 hit weeks earns a streak freeze (max 2 banked). A missed week
--     automatically spends a freeze instead of resetting the streak.
--
-- Streaks are computed here, server-side, so they are consistent across
-- devices and visible to crewmates later. Clients never write them directly.

-- ─── Profiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text,
  avatar_url          text,
  timezone            text not null default 'UTC',
  weekly_goal         smallint not null default 3 check (weekly_goal between 1 and 7),
  min_workout_minutes smallint not null default 15 check (min_workout_minutes between 1 and 240),
  onboarded_at        timestamptz,
  created_at          timestamptz not null default now()
);

create function public.validate_profile_timezone()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- Create a profile row whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Health data ─────────────────────────────────────────────────────────────

create table public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  source        text not null default 'healthkit' check (source in ('healthkit', 'manual')),
  external_id   text,               -- HealthKit sample UUID, used to dedupe re-syncs
  activity_type text not null,      -- e.g. 'running', 'traditionalStrengthTraining'
  started_at    timestamptz not null,
  ended_at      timestamptz not null,
  duration_s    integer not null check (duration_s >= 0),
  active_kcal   numeric,
  distance_m    numeric,
  avg_hr        numeric,
  max_hr        numeric,
  created_at    timestamptz not null default now(),
  check (ended_at >= started_at),
  unique (user_id, source, external_id)
);

create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

-- One row per user per local calendar day, aggregated on the device.
create table public.daily_activity (
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day          date not null,
  steps        integer,
  active_kcal  numeric,
  exercise_min integer,
  resting_hr   numeric,
  updated_at   timestamptz not null default now(),
  primary key (user_id, day)
);

-- ─── Streaks ─────────────────────────────────────────────────────────────────

create table public.streaks (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  current_weeks   integer not null default 0,
  longest_weeks   integer not null default 0,
  freezes_banked  smallint not null default 0,
  this_week_start date,
  this_week_days  smallint not null default 0,
  this_week_goal  smallint not null default 3,
  updated_at      timestamptz not null default now()
);

create table public.streak_weeks (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  week_start  date not null,          -- Monday, in the user's timezone
  active_days smallint not null,
  goal        smallint not null,      -- snapshot of the goal for that week
  status      text not null check (status in ('hit', 'frozen', 'missed', 'in_progress')),
  primary key (user_id, week_start)
);

-- Rebuilds a user's streak from their full workout history. History is small
-- (a few workouts a week), so recomputing from scratch keeps this simple and
-- self-healing when workouts are edited or deleted.
create function public.recompute_streak(p_user uuid, p_now timestamptz default now())
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
           sw.goal as saved_goal
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

revoke execute on function public.recompute_streak(uuid, timestamptz) from public, anon, authenticated;

-- Called by the app on launch so a streak that lapsed over the weekend (with
-- no new workouts to trigger a recompute) is reflected right away.
create function public.refresh_my_streak()
returns public.streaks
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.streaks;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  perform public.recompute_streak(auth.uid());
  select * into result from public.streaks where user_id = auth.uid();
  return result;
end;
$$;

revoke execute on function public.refresh_my_streak() from public, anon;
grant execute on function public.refresh_my_streak() to authenticated;

-- Keep streaks current whenever workouts change. Statement-level triggers so a
-- batch upsert of 50 workouts recomputes once per user, not 50 times.
create function public.workouts_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if tg_op = 'DELETE' then
    for uid in select distinct user_id from old_rows loop
      perform public.recompute_streak(uid);
    end loop;
  else
    for uid in select distinct user_id from new_rows loop
      perform public.recompute_streak(uid);
    end loop;
  end if;
  return null;
end;
$$;

create trigger workouts_after_insert
  after insert on public.workouts
  referencing new table as new_rows
  for each statement execute function public.workouts_changed();

create trigger workouts_after_update
  after update on public.workouts
  referencing new table as new_rows
  for each statement execute function public.workouts_changed();

create trigger workouts_after_delete
  after delete on public.workouts
  referencing old table as old_rows
  for each statement execute function public.workouts_changed();

create function public.profile_streak_settings_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_streak(new.id);
  return null;
end;
$$;

create trigger profiles_after_streak_settings_update
  after update of timezone, weekly_goal, min_workout_minutes on public.profiles
  for each row
  when (old.timezone is distinct from new.timezone
     or old.weekly_goal is distinct from new.weekly_goal
     or old.min_workout_minutes is distinct from new.min_workout_minutes)
  execute function public.profile_streak_settings_changed();

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.workouts       enable row level security;
alter table public.daily_activity enable row level security;
alter table public.streaks        enable row level security;
alter table public.streak_weeks   enable row level security;

create policy "Read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Read own workouts" on public.workouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own workouts" on public.workouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own workouts" on public.workouts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own workouts" on public.workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Read own daily activity" on public.daily_activity
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own daily activity" on public.daily_activity
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own daily activity" on public.daily_activity
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Streaks are read-only for clients; only the functions above write them.
create policy "Read own streak" on public.streaks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Read own streak weeks" on public.streak_weeks
  for select to authenticated using ((select auth.uid()) = user_id);
