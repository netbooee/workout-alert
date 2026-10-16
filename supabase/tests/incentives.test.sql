-- Incentives offered by partners. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- A 30-minute workout `p_day` days after the incentive window opened.
create function pg_temp.workout(p_user uuid, p_day int, p_source text default 'healthkit', p_type text default 'running')
returns uuid language sql as $$
  insert into public.workouts (user_id, source, external_id, activity_type, started_at, ended_at, duration_s)
  select p_user, p_source, case when p_source = 'healthkit' then gen_random_uuid()::text end, p_type,
         i.starts_at + make_interval(days => p_day, hours => 9),
         i.starts_at + make_interval(days => p_day, hours => 9, mins => 30), 1800
  from public.incentives i order by created_at desc limit 1
  returning id;
$$;

-- Sam offers incentives to Jo. Lee is a stranger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'sam@example.com', '{"full_name": "Sam Rivera"}'),
  ('00000000-0000-0000-0000-00000000000b', 'jo@example.com', '{"full_name": "Jo Park"}'),
  ('00000000-0000-0000-0000-00000000000c', 'lee@example.com', '{"full_name": "Lee Wu"}');
insert into public.partnerships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

-- ─── Offering ────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'workout_days', 3, 1, 'Coffee on me')$$,
  '42501', null, 'only partners can offer an incentive');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$select public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'workout_days', 8, 1, 'Coffee on me')$$,
  '22023', null, 'goals must be achievable in the window (8 days in 1 week)');
select throws_ok(
  $$select public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'workout_days', 3, 1, '   ')$$,
  '23514', null, 'a reward is required');
select throws_ok(
  $$insert into public.incentives (from_id, to_id, goal_kind, goal_target, weeks, starts_at, ends_at, reward)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'workout_days', 1, 1,
            now(), now() + interval '1 day', 'x')$$,
  '42501', null, 'clients cannot write incentives directly');

create temp table offer as
  select * from public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'workout_days', 3, 1, 'Coffee on me', '☕',
    p_notes => '  Gym sessions count double. You pick the café!  ');
grant select on offer to authenticated;

select is((select status from offer), 'offered', 'a partner can offer an incentive');
select is((select notes from offer), 'Gym sessions count double. You pick the café!', 'the offer keeps its rules and notes, trimmed');
select throws_ok(
  $$select public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'active_minutes', 60, 1, 'Pizza')$$,
  'P0001', 'You already have an incentive going with them', 'only one open incentive per partner');

reset role;
select results_eq(
  $$select user_id, title, body from public.notifications where kind = 'incentive'$$,
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid, 'Sam offered you an incentive 🎁'::text,
            'Hit 3 workout days this week → ☕ Coffee on me · Gym sessions count double. You pick the café!'::text)$$,
  'the recipient is notified of the offer');
select is(
  (select extract(dow from starts_at at time zone 'UTC')::int from offer), 0,
  'the window starts on Sunday in the recipient''s timezone');

-- ─── Visibility ──────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*) from public.incentives), 0::bigint, 'strangers cannot see incentives');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.incentives), 1::bigint, 'the recipient can see it');

-- ─── Accepting and progress ──────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.respond_to_incentive((select id from offer), true)$$,
  'P0002', null, 'the giver cannot accept their own offer');

reset role;
select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 0);

delete from public.notifications;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((public.respond_to_incentive((select id from offer), true)).progress, 1,
  'accepting counts workouts already done this week');
reset role;
select results_eq(
  $$select user_id, title from public.notifications$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid, 'Jo accepted your incentive 🎁'::text)$$,
  'the giver is told it was accepted');

select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 0);
select is((select progress from public.incentives), 1, 'two workouts on one day count as one day');

delete from public.notifications;
select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 1);
select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 2);
select is((select status from public.incentives), 'earned', 'hitting the goal earns the incentive');
select is((select amount from public.xp_events where kind = 'incentive'), 100, 'earning it is worth 100 XP');
select bag_eq(
  $$select user_id, title, body from public.notifications$$,
  $$values
    ('00000000-0000-0000-0000-00000000000b'::uuid, 'You earned Sam’s incentive! 🎉'::text, '☕ Coffee on me · +100 XP'::text),
    ('00000000-0000-0000-0000-00000000000a'::uuid, 'Jo earned your incentive 🎉'::text, 'Time to deliver: ☕ Coffee on me'::text)$$,
  'both people are notified when it is earned');

delete from public.workouts where user_id = '00000000-0000-0000-0000-00000000000b'
  and started_at = (select max(started_at) from public.workouts);
select is((select status from public.incentives), 'earned', 'deleting a workout afterwards does not take it back');

-- ─── Delivering ──────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.mark_incentive_delivered((select id from offer))$$,
  'P0002', null, 'only the giver can mark it delivered');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((public.mark_incentive_delivered((select id from offer))).status, 'delivered',
  'the giver marks the reward delivered');

-- ─── Verified only ───────────────────────────────────────────────────────────

create temp table strict_offer as
  select * from public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'workouts', 1, 1, 'Smoothie', '🥤', 'yoga', true);
grant select on strict_offer to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.respond_to_incentive((select id from strict_offer), true);
reset role;
create temp table manual as select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 3, 'manual', 'yoga') as id;
select is((select progress from public.incentives where id = (select id from strict_offer)), 0,
  'verified-only ignores hand-logged workouts');
grant select on manual to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.reactions (workout_id, kind) values ((select id from manual), 'verified');
reset role;
select is((select status from public.incentives where id = (select id from strict_offer)), 'earned',
  'a partner verifying the workout makes it count');

-- ─── Expiry and cancelling ───────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
create temp table long_offer as
  select * from public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'active_minutes', 3000, 2, 'Massage', '💆');
grant select on long_offer to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.respond_to_incentive((select id from long_offer), true);
reset role;
update public.incentives set ends_at = now() - interval '1 second', starts_at = now() - interval '2 weeks'
where id = (select id from long_offer);
select public.expire_incentives();
select is((select status from public.incentives where id = (select id from long_offer)), 'expired',
  'incentives expire when the window ends');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'streak_weeks', 6, 4, 'New shoes', '👟');
select is((public.cancel_incentive((select id from public.incentives where status = 'offered'))).status, 'cancelled',
  'the giver can cancel an open offer');

select * from finish();
rollback;
