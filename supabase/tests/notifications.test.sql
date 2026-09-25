-- Push notifications: tokens, nudge + partner-workout notifications, delivery.
-- Run with: supabase test db. Everything rolls back, so queued pushes are never sent.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.add_workout(p_user uuid, p_end timestamptz, p_minutes int, p_type text default 'running')
returns uuid language sql as $$
  insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
  values (p_user, 'manual', p_type, p_end - make_interval(mins => p_minutes), p_end, p_minutes * 60)
  returning id;
$$;

-- Pushes queued by pg_net during this transaction.
create function pg_temp.pushes() returns setof jsonb language sql as $$
  select jsonb_array_elements(convert_from(body, 'utf8')::jsonb) from net.http_request_queue;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex Kim"}'),
  ('00000000-0000-0000-0000-00000000000b', 'blair@example.com', '{"full_name": "Blair Fox"}'),
  ('00000000-0000-0000-0000-00000000000c', 'casey@example.com', '{"full_name": "Casey Li"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dana@example.com', '{"full_name": "Dana Ro"}');

-- Alex–Blair and Alex–Casey are partners; Dana has only asked Alex.
insert into public.partnerships (requester_id, addressee_id, status, accepted_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted', now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a', 'accepted', now()),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a', 'pending', null);

-- ─── Tokens ──────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$select public.register_push_token('ExponentPushToken[blair-phone]')$$,
  'users can register an Expo push token');
select throws_ok($$select public.register_push_token('not-a-token')$$,
  '22023', 'Not an Expo push token', 'malformed tokens are rejected');

-- Casey signs in on a phone Dana used before: the token moves to Casey.
reset role;
insert into public.push_tokens (token, user_id)
values ('ExponentPushToken[shared-phone]', '00000000-0000-0000-0000-00000000000d');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.register_push_token('ExponentPushToken[shared-phone]');
reset role;
select is((select user_id from public.push_tokens where token = 'ExponentPushToken[shared-phone]'),
  '00000000-0000-0000-0000-00000000000c'::uuid, 'a device token belongs to its most recent user');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*) from public.push_tokens), 1::bigint, 'users only see their own tokens');

-- ─── Nudges ──────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.nudge_partner('00000000-0000-0000-0000-00000000000b');
reset role;

select results_eq(
  $$select title, body, url from public.notifications where kind = 'nudge'$$,
  $$values ('Alex nudged you 👋'::text, 'Your partners are counting on you. Time to move!'::text, '/'::text)$$,
  'a nudge notifies the person nudged');
select results_eq(
  $$select p ->> 'to', p ->> 'title', p -> 'data' ->> 'url' from pg_temp.pushes() p$$,
  $$values ('ExponentPushToken[blair-phone]'::text, 'Alex nudged you 👋'::text, '/'::text)$$,
  'the nudge is pushed to the recipient''s device');

-- With a streak row, the body shows this week's progress.
delete from public.notifications;
delete from net.http_request_queue;
delete from public.nudges;
update public.profiles set weekly_goal = 4 where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.add_workout('00000000-0000-0000-0000-00000000000b', now() - interval '3 days', 30);
delete from public.notifications;
delete from net.http_request_queue;
insert into public.nudges (from_id, to_id)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
select matches((select body from public.notifications where kind = 'nudge'),
  '^You''re at \d of 4 days this week\. Time to move!$', 'nudges mention your weekly progress');

delete from public.notifications;
update public.profiles set notify_nudges = false where id = '00000000-0000-0000-0000-00000000000b';
insert into public.nudges (from_id, to_id)
values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.notifications), 0::bigint, 'nudge notifications can be turned off');

-- ─── Partner workouts ────────────────────────────────────────────────────────

delete from public.notifications;
delete from net.http_request_queue;
create temp table w as
  select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', now() - interval '10 minutes', 42) as id;

select set_eq(
  $$select user_id from public.notifications where kind = 'partner_workout'$$,
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid), ('00000000-0000-0000-0000-00000000000c'::uuid)$$,
  'a new workout notifies every accepted partner (not pending requests or yourself)');
select is((select distinct title from public.notifications), 'Alex just worked out 🔥',
  'the title names who worked out');
select is((select distinct body from public.notifications), '42-min run. Tap to cheer or verify ✅',
  'the body describes the workout');
select is((select distinct url from public.notifications), '/workout/' || (select id from w),
  'tapping opens the workout');
select is((select count(*) from pg_temp.pushes()), 2::bigint,
  'pushes go to each partner''s registered devices');

delete from public.notifications;
select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', now() - interval '3 days', 42);
select is((select count(*) from public.notifications), 0::bigint,
  'older workouts (e.g. the first HealthKit backfill) do not notify');

select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', now() - interval '5 minutes', 3);
select is((select count(*) from public.notifications), 0::bigint, 'workouts under 5 minutes do not notify');

update public.profiles set notify_partner_workouts = false where id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', now(), 30, 'yoga');
select results_eq(
  $$select user_id, body from public.notifications$$,
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid, '30-min yoga session. Tap to cheer or verify ✅'::text)$$,
  'partners can turn off workout notifications');

-- ─── RLS ─────────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*) from public.notifications), 0::bigint, 'users only see their own notifications');

select * from finish();
rollback;
