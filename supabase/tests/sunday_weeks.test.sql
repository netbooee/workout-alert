-- Weeks run Sunday to Saturday. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

-- Fixed clock: Thursday 2026-10-15 12:00 UTC. The current week starts Sun 10-11.
create temp table t as select '2026-10-15 12:00+00'::timestamptz as now_ts;
grant select on t to authenticated;

create function pg_temp.workouts(p_user uuid, p_days date[]) returns void language sql as $$
  insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
  select p_user, 'manual', 'running', d + time '12:00', d + time '12:30', 1800 from unnest(p_days) d;
$$;

create function pg_temp.recompute(p_user uuid) returns public.streaks language sql as $$
  select public.recompute_streak(p_user, (select now_ts from t));
  select * from public.streaks where user_id = p_user;
$$;

create function pg_temp.status(p_user uuid, p_week date) returns text language sql as $$
  select status from public.streak_weeks where user_id = p_user and week_start = p_week;
$$;

select results_eq(
  $$select public.week_of(d) from unnest(array['2026-10-11', '2026-10-15', '2026-10-17', '2026-10-18']::date[]) d$$,
  $$values ('2026-10-11'::date), ('2026-10-11'::date), ('2026-10-11'::date), ('2026-10-18'::date)$$,
  'a week runs from Sunday through Saturday');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}');
update public.profiles set weekly_goal = 2, timezone = 'UTC', created_at = '2026-09-01';

-- Sunday and Saturday are the ends of the same week.
select pg_temp.workouts('00000000-0000-0000-0000-00000000000a', array['2026-10-04', '2026-10-10']::date[]);
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).this_week_start, '2026-10-11'::date,
  'the current week starts on Sunday');
select is(pg_temp.status('00000000-0000-0000-0000-00000000000a', '2026-10-04'), 'hit',
  'a Sunday and the following Saturday count toward one week');

-- A week hit before the switch (one of its days moved to the next week) stays hit.
select pg_temp.workouts('00000000-0000-0000-0000-00000000000a', array['2026-09-28']::date[]);
select pg_temp.recompute('00000000-0000-0000-0000-00000000000a');
select is(pg_temp.status('00000000-0000-0000-0000-00000000000a', '2026-09-27'), 'missed',
  'one day short of the goal is a miss');
insert into public.legacy_week_hits (user_id, week_start, goal)
values ('00000000-0000-0000-0000-00000000000a', '2026-09-27', 2);
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).current_weeks, 2,
  'a week hit before the switch to Sunday weeks still counts');
select is(pg_temp.status('00000000-0000-0000-0000-00000000000a', '2026-09-27'), 'hit',
  'and is marked hit');
update public.profiles set weekly_goal = 3 where id = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.status('00000000-0000-0000-0000-00000000000a', '2026-09-27'), 'hit',
  'it keeps the goal it was hit with, like any week since joining');

-- League weeks start Sunday too.
select pg_temp.workouts('00000000-0000-0000-0000-00000000000a', array['2026-10-11']::date[]);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a"}', true);
set local role authenticated;
select is((select xp from public.weekly_league((select now_ts from t))),
  (select sum(amount)::int from public.xp_events
   where user_id = '00000000-0000-0000-0000-00000000000a' and created_at >= '2026-10-11'),
  'the league counts XP from Sunday');
reset role;

select * from finish();
rollback;
