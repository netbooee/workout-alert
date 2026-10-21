-- "What counts": the shortest workout that counts, and a separate bar for walks. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- A workout today (an hour ago) lasting `p_minutes`.
create function pg_temp.workout(p_user uuid, p_type text, p_minutes int, p_hours_ago int default 1)
returns uuid language sql as $$
  insert into public.workouts (user_id, source, external_id, activity_type, started_at, ended_at, duration_s)
  values (p_user, 'healthkit', gen_random_uuid()::text, p_type,
          now() - make_interval(hours => p_hours_ago, mins => p_minutes), now() - make_interval(hours => p_hours_ago),
          p_minutes * 60)
  returning id;
$$;

create function pg_temp.counted(p_id uuid) returns boolean language sql as $$
  select counted from public.workouts where id = p_id;
$$;

create function pg_temp.xp(p_id uuid) returns bigint language sql as $$
  select coalesce(sum(amount), 0) from public.xp_events where ref = p_id::text and kind = 'workout';
$$;

-- Tony walks a lot; Ana is his partner.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'tony@example.com', '{"full_name": "Tony"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ana@example.com', '{"full_name": "Ana"}');
update public.profiles set onboarded_at = now(), weekly_goal = 1;
insert into public.partnerships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

-- ─── Default: 15 minutes for everything ─────────────────────────────────────

create temp table w as select
  pg_temp.workout('00000000-0000-0000-0000-00000000000a', 'walking', 12, 3) as short_walk,
  pg_temp.workout('00000000-0000-0000-0000-00000000000a', 'walking', 20, 2) as walk,
  pg_temp.workout('00000000-0000-0000-0000-00000000000a', 'running', 25, 1) as run;

select ok(not pg_temp.counted((select short_walk from w)), 'a 12-minute walk does not count by default');
select is(pg_temp.xp((select short_walk from w)), 0::bigint, 'and earns no XP');
select ok(pg_temp.counted((select walk from w)), 'a 20-minute walk counts by default');
select is(
  (select count(*) from public.notifications where kind = 'partner_workout'
     and body like '12-min%'),
  0::bigint, 'partners are not told about a workout that does not count');

-- ─── A higher bar for walks ─────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.profiles set min_walk_minutes = 30 where id = '00000000-0000-0000-0000-00000000000a';
reset role;

select ok(not pg_temp.counted((select walk from w)), 'raising the walk bar to 30 minutes uncounts a 20-minute walk');
select is(pg_temp.xp((select walk from w)), 0::bigint, 'and takes back its XP');
select ok(pg_temp.counted((select run from w)), 'other workouts still use the general bar');
select is((select this_week_days::int from public.streaks where user_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'the streak still counts the day (the run)');

-- ─── Leaving walks out ──────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.profiles set count_walks = false, min_walk_minutes = null
where id = '00000000-0000-0000-0000-00000000000a';
reset role;
create temp table long_walk as
  select pg_temp.workout('00000000-0000-0000-0000-00000000000a', 'walking', 60, 0) as id;
select ok(not pg_temp.counted((select id from long_walk)), 'with walks left out, even an hour-long walk does not count');

-- Ana only walks today: her streak counts the day until she leaves walks out.
select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 'walking', 30);
select is((select this_week_days::int from public.streaks where user_id = '00000000-0000-0000-0000-00000000000b'), 1,
  'a 30-minute walk counts toward the streak');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.profiles set count_walks = false where id = '00000000-0000-0000-0000-00000000000b';
reset role;
select is((select this_week_days::int from public.streaks where user_id = '00000000-0000-0000-0000-00000000000b'), 0,
  'leaving walks out recomputes the streak');

-- ─── A lower general bar ────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.profiles set min_workout_minutes = 10, count_walks = true where id = '00000000-0000-0000-0000-00000000000a';
reset role;
select ok(pg_temp.counted((select short_walk from w)), 'lowering the bar to 10 minutes counts the 12-minute walk');
select ok(pg_temp.xp((select short_walk from w)) > 0, 'and gives its XP back');

-- Rules can't be set out of range.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$update public.profiles set min_walk_minutes = 0 where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'a walk bar must be at least 1 minute');
reset role;

select * from finish();
rollback;
