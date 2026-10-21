-- Shared quests: both partners' workouts count toward one incentive. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- A 30-minute workout `p_day` days after the latest incentive's window opened.
create function pg_temp.workout(p_user uuid, p_day int, p_hour int default 9)
returns uuid language sql as $$
  insert into public.workouts (user_id, source, external_id, activity_type, started_at, ended_at, duration_s)
  select p_user, 'healthkit', gen_random_uuid()::text, 'running',
         i.starts_at + make_interval(days => p_day, hours => p_hour),
         i.starts_at + make_interval(days => p_day, hours => p_hour, mins => 30), 1800
  from public.incentives i order by created_at desc limit 1
  returning id;
$$;

-- Sam starts shared quests with Jo.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'sam@example.com', '{"full_name": "Sam Rivera"}'),
  ('00000000-0000-0000-0000-00000000000b', 'jo@example.com', '{"full_name": "Jo Park"}');
insert into public.partnerships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

-- ─── Offering ────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$select public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'streak_weeks', 4, 4, 'Pizza',
      p_shared => true)$$,
  '22023', 'A shared quest counts days, workouts, or minutes', 'a shared quest cannot be a streak goal');
select throws_ok(
  $$select public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'workout_days', 15, 1, 'Pizza',
      p_shared => true)$$,
  '22023', null, 'two people can share at most 14 workout days a week');

create temp table quest as
  select * from public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'workout_days', 4, 1, 'Pizza night',
    '🍕', p_shared => true);
reset role;
grant select on quest to authenticated;

select ok((select shared from quest), 'a partner can start a shared quest with a doubled-up target');
select is((select public.incentive_goal_text(i) from public.incentives i),
  'Hit 4 workout days between us this week', 'the goal reads "between us"');
select is((select title from public.notifications where kind = 'incentive'),
  'Sam started a shared quest with you 🤝', 'the partner hears about the shared quest');

-- ─── Progress from both people ──────────────────────────────────────────────

select pg_temp.workout('00000000-0000-0000-0000-00000000000a', 0);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((public.respond_to_incentive((select id from quest), true)).progress, 1,
  'accepting counts the giver’s workouts already done this week');
reset role;

select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 0);
select results_eq($$select progress, from_progress from public.incentives$$, $$values (2, 1)$$,
  'the same day counts once for each person');

select pg_temp.workout('00000000-0000-0000-0000-00000000000a', 0, 18);
select is((select progress from public.incentives), 2, 'a second workout the same day adds nothing');

select pg_temp.workout('00000000-0000-0000-0000-00000000000a', 1);
select results_eq($$select progress, from_progress from public.incentives$$, $$values (3, 2)$$,
  'the giver’s workouts update the shared progress');

-- ─── Earning ────────────────────────────────────────────────────────────────

delete from public.notifications;
select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 1);
select is((select status from public.incentives), 'earned', 'hitting the shared goal earns it');
select results_eq(
  $$select user_id, amount from public.xp_events where kind = 'incentive' order by user_id$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid, 100), ('00000000-0000-0000-0000-00000000000b'::uuid, 100)$$,
  'both people earn 100 XP');
select results_eq(
  $$select user_id, title from public.notifications where kind = 'incentive' order by user_id$$,
  $$values
    ('00000000-0000-0000-0000-00000000000a'::uuid, 'You and Jo finished your shared quest! 🎉'::text),
    ('00000000-0000-0000-0000-00000000000b'::uuid, 'You and Sam finished your shared quest! 🎉'::text)$$,
  'both people are told');

-- Either person can mark the shared reward done.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((public.mark_incentive_delivered((select id from quest))).status, 'delivered',
  'the recipient can mark a shared reward delivered');
reset role;

-- ─── Regular incentives are unchanged ───────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
create temp table solo as
  select * from public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'workout_days', 2, 1, 'Coffee', '☕');
reset role;
grant select on solo to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.respond_to_incentive((select id from solo), true);
reset role;
select is((select progress from public.incentives where id = (select id from solo)), 2,
  'a regular incentive counts only the recipient (Jo has 2 days this week)');
select pg_temp.workout('00000000-0000-0000-0000-00000000000a', 2);
select is((select from_progress from public.incentives where id = (select id from solo)), 0,
  'the giver’s workouts never count toward a regular incentive');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.mark_incentive_delivered((select id from solo))$$,
  'P0002', null, 'the recipient still cannot mark a regular reward delivered');
reset role;

select * from finish();
rollback;
