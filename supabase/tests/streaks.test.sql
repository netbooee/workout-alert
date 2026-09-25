-- Streak engine + RLS tests. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(26);

-- Fixed clock: Thursday 2026-09-24 12:00 UTC. Current week starts Mon 09-21.
create temp table t_now as select '2026-09-24 12:00:00+00'::timestamptz as ts;

create function pg_temp.add_workout(p_user uuid, p_start timestamptz, p_minutes int)
returns void language sql as $$
  insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
  values (p_user, 'manual', 'running', p_start, p_start + make_interval(mins => p_minutes), p_minutes * 60);
$$;

create function pg_temp.recompute(p_user uuid)
returns public.streaks language sql as $$
  select public.recompute_streak(p_user, (select ts from t_now));
  select * from public.streaks where user_id = p_user;
$$;

create function pg_temp.week_status(p_user uuid, p_week date)
returns text language sql as $$
  select status from public.streak_weeks where user_id = p_user and week_start = p_week;
$$;

-- ─── Signup creates a profile ────────────────────────────────────────────────

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex"}'),
  ('00000000-0000-0000-0000-00000000000b', 'sam@example.com', '{}');

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Alex', 'signup creates a profile with the full name');
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'sam', 'display name falls back to the email prefix');

-- ─── Basic counting ──────────────────────────────────────────────────────────

select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).current_weeks, 0,
  'no workouts means no streak');

-- Goal defaults to 3 days. Two workouts on Monday count as one active day,
-- and a 10-minute walk on Tuesday is below the 15-minute minimum.
select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', '2026-09-21 07:00Z', 30);
select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', '2026-09-21 18:00Z', 30);
select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', '2026-09-22 07:00Z', 10);

select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).this_week_days, 1::smallint,
  'multiple workouts on one day count once; short workouts do not count');
select is(pg_temp.week_status('00000000-0000-0000-0000-00000000000a', '2026-09-21'), 'in_progress',
  'current week below goal is in progress');
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).current_weeks, 0,
  'in-progress week does not add to the streak yet');

select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', '2026-09-23 07:00Z', 20);
select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', '2026-09-24 07:00Z', 45);

select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).current_weeks, 1,
  'hitting the goal this week starts the streak');
select is(pg_temp.week_status('00000000-0000-0000-0000-00000000000a', '2026-09-21'), 'hit',
  'current week is marked hit');

-- ─── Workouts from the trigger path ──────────────────────────────────────────

select pg_temp.add_workout('00000000-0000-0000-0000-00000000000b', now(), 30);
select ok(exists(select 1 from public.streaks where user_id = '00000000-0000-0000-0000-00000000000b'),
  'inserting a workout recomputes the streak via trigger');

-- ─── Freezes ─────────────────────────────────────────────────────────────────
-- Sam: goal 1/week. Hit 4 weeks (08-10 .. 08-31) which earns a freeze,
-- miss 09-07, hit 09-14; the current week (09-21) has nothing yet.
delete from public.workouts where user_id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set weekly_goal = 1 where id = '00000000-0000-0000-0000-00000000000b';

select pg_temp.add_workout('00000000-0000-0000-0000-00000000000b', d, 30)
from unnest(array['2026-08-10 12:00Z', '2026-08-17 12:00Z', '2026-08-24 12:00Z',
                  '2026-08-31 12:00Z', '2026-09-14 12:00Z']::timestamptz[]) as d;

select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000b')).current_weeks, 5,
  'a missed week is covered by an earned freeze (4 hits + 1 after the freeze)');
select is(pg_temp.week_status('00000000-0000-0000-0000-00000000000b', '2026-09-07'), 'frozen',
  'the missed week is marked frozen');
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000b')).freezes_banked, 0::smallint,
  'the freeze was spent');
select is(pg_temp.week_status('00000000-0000-0000-0000-00000000000b', '2026-09-21'), 'in_progress',
  'current week with no workouts is in progress, not missed');

-- Without the freeze (only 3 hits before the gap) the streak resets.
delete from public.workouts where user_id = '00000000-0000-0000-0000-00000000000b'
  and started_at = '2026-08-10 12:00Z';
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000b')).current_weeks, 1,
  'a missed week without a freeze resets the streak');
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000b')).longest_weeks, 3,
  'longest streak is remembered');
select is(pg_temp.week_status('00000000-0000-0000-0000-00000000000b', '2026-09-07'), 'missed',
  'the gap week is marked missed');
select is((select min(week_start) from public.streak_weeks
           where user_id = '00000000-0000-0000-0000-00000000000b'), '2026-08-17'::date,
  'weeks before the earliest workout are dropped after a delete');

-- ─── Timezones ───────────────────────────────────────────────────────────────
-- Monday 02:00 UTC is still Sunday evening in Los Angeles.
delete from public.workouts where user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.add_workout('00000000-0000-0000-0000-00000000000b', '2026-09-21 02:00Z', 30);
update public.profiles set timezone = 'America/Los_Angeles'
where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.recompute('00000000-0000-0000-0000-00000000000b');

select is(pg_temp.week_status('00000000-0000-0000-0000-00000000000b', '2026-09-14'), 'hit',
  'workouts are bucketed into weeks by the user''s local time');
select throws_ok(
  $$update public.profiles set timezone = 'Mars/Olympus' where id = '00000000-0000-0000-0000-00000000000b'$$,
  '22023', 'Unknown timezone: Mars/Olympus', 'invalid timezones are rejected');

-- ─── Goal changes ────────────────────────────────────────────────────────────
-- Alex hit 4 days this week with a goal of 3. Raising the goal to 5 applies to
-- the current week immediately.
update public.profiles set weekly_goal = 5 where id = '00000000-0000-0000-0000-00000000000a';
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).current_weeks, 0,
  'raising the goal re-evaluates the current week');
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).this_week_goal, 5::smallint,
  'current week uses the new goal');

-- ─── Row level security ──────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b"}';

select is((select count(*) from public.workouts where user_id = '00000000-0000-0000-0000-00000000000a'), 0::bigint,
  'users cannot read other users'' workouts');
select is((select count(*) from public.profiles), 1::bigint,
  'users can only read their own profile');
select throws_ok(
  $$insert into public.workouts (user_id, activity_type, started_at, ended_at, duration_s)
    values ('00000000-0000-0000-0000-00000000000a', 'running', now(), now(), 60)$$,
  '42501', null, 'users cannot insert workouts for someone else');
select is_empty(
  $$update public.streaks set current_weeks = 999 returning 1$$,
  'users cannot write streaks directly');
select is((public.refresh_my_streak()).user_id, '00000000-0000-0000-0000-00000000000b'::uuid,
  'refresh_my_streak recomputes and returns the caller''s streak');

select * from finish();
rollback;
