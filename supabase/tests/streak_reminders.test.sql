-- "Streak at risk" reminders. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

-- Chicago is UTC-5 in September, Los Angeles UTC-7. The current week starts Mon 09-21.
create temp table t as select
  '2026-09-25 22:00+00'::timestamptz as fri_5pm_chi,
  '2026-09-25 23:00+00'::timestamptz as fri_6pm_chi,
  '2026-09-26 01:00+00'::timestamptz as fri_6pm_la,
  '2026-09-27 23:00+00'::timestamptz as sun_6pm_chi;

create function pg_temp.user(p_id uuid, p_name text, p_goal int, p_tz text default 'America/Chicago')
returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_name || '@example.com', json_build_object('full_name', p_name));
  update public.profiles
  set weekly_goal = p_goal, timezone = p_tz, onboarded_at = '2026-08-01'
  where id = p_id;
$$;

create function pg_temp.workouts(p_user uuid, p_days text[]) returns void language sql as $$
  insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
  select p_user, 'manual', 'running', (d || ' 12:00+00')::timestamptz, (d || ' 12:30+00')::timestamptz, 1800
  from unnest(p_days) as d;
$$;

create function pg_temp.reminders() returns setof uuid language sql as $$
  select user_id from public.notifications where kind = 'streak_risk';
$$;

-- Ava (goal 3): hit the last two weeks, nothing yet this week.
select pg_temp.user('00000000-0000-0000-0000-00000000000a', 'Ava', 3);
select pg_temp.workouts('00000000-0000-0000-0000-00000000000a',
  array['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-15', '2026-09-16', '2026-09-17']);
-- Ben (goal 1): hit the last two weeks, nothing this week.
select pg_temp.user('00000000-0000-0000-0000-00000000000b', 'Ben', 1);
select pg_temp.workouts('00000000-0000-0000-0000-00000000000b', array['2026-09-08', '2026-09-15']);
-- Cam (goal 3): already done this week.
select pg_temp.user('00000000-0000-0000-0000-00000000000c', 'Cam', 3);
select pg_temp.workouts('00000000-0000-0000-0000-00000000000c',
  array['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-21', '2026-09-22', '2026-09-23']);
-- Dee (goal 2): no streak to lose.
select pg_temp.user('00000000-0000-0000-0000-00000000000d', 'Dee', 2);
-- Eli (goal 3, Los Angeles): same history as Ava.
select pg_temp.user('00000000-0000-0000-0000-00000000000e', 'Eli', 3, 'America/Los_Angeles');
select pg_temp.workouts('00000000-0000-0000-0000-00000000000e',
  array['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-15', '2026-09-16', '2026-09-17']);
-- Fay (goal 2): hit the last two weeks, nothing this week.
select pg_temp.user('00000000-0000-0000-0000-00000000000f', 'Fay', 2);
select pg_temp.workouts('00000000-0000-0000-0000-00000000000f',
  array['2026-09-08', '2026-09-09', '2026-09-15', '2026-09-16']);
-- Gus (goal 1): five straight weeks, so he has a freeze banked.
select pg_temp.user('00000000-0000-0000-0000-000000000001', 'Gus', 1);
select pg_temp.workouts('00000000-0000-0000-0000-000000000001',
  array['2026-08-18', '2026-08-25', '2026-09-01', '2026-09-08', '2026-09-15']);

insert into public.push_tokens (token, user_id)
values ('ExponentPushToken[ava]', '00000000-0000-0000-0000-00000000000a');
delete from public.notifications;
delete from net.http_request_queue;

-- ─── Friday ──────────────────────────────────────────────────────────────────

select is(public.send_streak_reminders((select fri_5pm_chi from t)), 0, 'nothing is sent before 6pm local');

select is(public.send_streak_reminders((select fri_6pm_chi from t)), 2, 'Friday 6pm sends reminders');
select set_eq($$select * from pg_temp.reminders()$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid), ('00000000-0000-0000-0000-00000000000f'::uuid)$$,
  'only at-risk streaks are reminded (not on-track, done, no-streak, or other timezones)');
select results_eq(
  $$select title, body, url from public.notifications where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  $$values ('Your 2-week streak is on the line 🔥'::text,
            'You need a workout every day left this week: 3 to go.'::text, '/'::text)$$,
  'needing every remaining day is "on the line"');
select is(
  (select body from public.notifications where user_id = '00000000-0000-0000-0000-00000000000f'),
  '2 more workout days needed with 3 days left this week.',
  'one spare day left is "at risk"');
select is(
  (select jsonb_array_elements(convert_from(body, 'utf8')::jsonb) ->> 'to' from net.http_request_queue),
  'ExponentPushToken[ava]', 'reminders are pushed to devices');

select is(public.send_streak_reminders((select fri_6pm_chi from t)), 0, 'running again the same day sends nothing new');

select is(public.send_streak_reminders((select fri_6pm_la from t)), 1, '6pm in Los Angeles is later in UTC');
select ok('00000000-0000-0000-0000-00000000000e' in (select * from pg_temp.reminders()),
  'reminders follow each person''s timezone');

-- ─── Sunday ──────────────────────────────────────────────────────────────────

delete from public.notifications;
select public.send_streak_reminders((select sun_6pm_chi from t));
select results_eq(
  $$select user_id, title, body from public.notifications order by title, user_id$$,
  $$values
    ('00000000-0000-0000-0000-00000000000b'::uuid, 'Last chance to keep your 2-week streak 🔥'::text,
     'One workout today keeps it alive.'::text),
    ('00000000-0000-0000-0000-000000000001'::uuid, 'Last chance to keep your 5-week streak 🔥'::text,
     'One workout today keeps it alive. (A freeze has your back if needed.)'::text)$$,
  'Sunday is the last chance, mentioning a banked freeze; out-of-reach weeks are not nagged');

delete from public.notifications;
update public.profiles set notify_streak_reminders = false where id = '00000000-0000-0000-0000-00000000000b';
select public.send_streak_reminders((select sun_6pm_chi from t));
select ok('00000000-0000-0000-0000-00000000000b' not in (select * from pg_temp.reminders()),
  'reminders can be turned off');

-- ─── Access ──────────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a"}', true);
set local role authenticated;
select throws_ok($$select public.send_streak_reminders()$$, '42501', null,
  'users cannot trigger reminders themselves');
reset role;

select ok(public.send_streak_reminders((select fri_5pm_chi from t)) = 0, 'the job is safe to run at any hour');

select * from finish();
rollback;
