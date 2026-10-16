-- Weeks from before you joined follow your current goal; weeks since joining stay
-- locked to the goal they had. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

-- Fixed clock: Thursday 2026-09-24 12:00 UTC. Current week starts Sun 09-20.
create temp table t_now as select '2026-09-24 12:00:00+00'::timestamptz as ts;

create function pg_temp.add_workout(p_user uuid, p_start timestamptz, p_minutes int)
returns void language sql as $$
  insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
  values (p_user, 'manual', 'walking', p_start, p_start + make_interval(mins => p_minutes), p_minutes * 60);
$$;

-- Three 30-minute workouts (Mon, Wed, Fri) in the week starting p_sunday.
create function pg_temp.three_days(p_user uuid, p_sunday date) returns void language sql as $$
  select pg_temp.add_workout(p_user, (p_sunday + d)::timestamp + time '07:00', 30) from unnest(array[1, 3, 5]) d;
$$;

create function pg_temp.set_goal(p_user uuid, p_goal int) returns public.streaks language sql as $$
  update public.profiles set weekly_goal = p_goal where id = p_user;
  select public.recompute_streak(p_user, (select ts from t_now));
  select * from public.streaks where user_id = p_user;
$$;

create function pg_temp.week_status(p_user uuid, p_week date) returns text language sql as $$
  select status from public.streak_weeks where user_id = p_user and week_start = p_week;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'shay@example.com', '{"full_name": "Shay"}'),
  ('00000000-0000-0000-0000-00000000000b', 'tom@example.com', '{"full_name": "Tom"}');
update public.profiles set timezone = 'UTC';

-- Shay joins this week (Tue 09-22). Her Health history has three workout days in
-- each of the three weeks before.
update public.profiles set created_at = '2026-09-22 12:00Z' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.three_days('00000000-0000-0000-0000-00000000000a', d)
  from unnest(array['2026-08-30', '2026-09-06', '2026-09-13']::date[]) d;

select is((pg_temp.set_goal('00000000-0000-0000-0000-00000000000a', 5)).current_weeks, 0,
  'with a goal of 5, three-day weeks before joining do not count');
select is((pg_temp.set_goal('00000000-0000-0000-0000-00000000000a', 3)).current_weeks, 3,
  'lowering the goal to 3 counts the three weeks from before joining');
select is(pg_temp.week_status('00000000-0000-0000-0000-00000000000a', '2026-09-13'), 'hit',
  'a pre-join week is re-checked against the new goal');
select is((pg_temp.set_goal('00000000-0000-0000-0000-00000000000a', 5)).current_weeks, 0,
  'raising the goal again re-checks pre-join weeks too');

-- Tom joined Wed 09-02 (week of 08-30) with a goal of 3 and has hit it every week,
-- plus one three-day week from before he joined.
update public.profiles set created_at = '2026-09-02 12:00Z' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.three_days('00000000-0000-0000-0000-00000000000b', d)
  from unnest(array['2026-08-23', '2026-08-30', '2026-09-06', '2026-09-13']::date[]) d;

select is((pg_temp.set_goal('00000000-0000-0000-0000-00000000000b', 3)).current_weeks, 4,
  'with a goal of 3, every three-day week counts');
select is((pg_temp.set_goal('00000000-0000-0000-0000-00000000000b', 5)).current_weeks, 3,
  'raising the goal only re-checks the week from before joining');
select is(pg_temp.week_status('00000000-0000-0000-0000-00000000000b', '2026-08-23'), 'missed',
  'the pre-join week now misses the higher goal');
select is(pg_temp.week_status('00000000-0000-0000-0000-00000000000b', '2026-09-13'), 'hit',
  'weeks since joining keep the goal they had');

select * from finish();
rollback;
