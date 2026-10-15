-- Comments and voice messages on workouts. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- Ana owns the workout. Ben and Cat are both Ana's partners but not each
-- other's. Dee is a stranger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana Ruiz"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@example.com', '{"full_name": "Ben Ode"}'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@example.com', '{"full_name": "Cat Lee"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@example.com', '{"full_name": "Dee Fox"}');
insert into public.partnerships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'accepted');

create temp table ana_workout as
  with w as (
    insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
    values ('00000000-0000-0000-0000-00000000000a', 'manual', 'running',
            now() - interval '3 days', now() - interval '3 days' + interval '40 minutes', 2400)
    returning id
  ) select id from w;
grant select on ana_workout to authenticated;
delete from public.notifications;

-- ─── Writing ─────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$insert into public.workout_comments (workout_id, body) values ((select id from ana_workout), 'Strong run! Keep it up 💪')$$,
  'a partner can comment on a workout');
select lives_ok(
  format($$insert into public.workout_comments (workout_id, audio_path, audio_duration_ms)
           values ((select id from ana_workout), '%s/comments/x/1.m4a', 12400)$$,
         '00000000-0000-0000-0000-00000000000b'),
  'a partner can send a voice message from their own folder');
select throws_ok(
  format($$insert into public.workout_comments (workout_id, audio_path, audio_duration_ms)
           values ((select id from ana_workout), '%s/comments/x/1.m4a', 5000)$$,
         '00000000-0000-0000-0000-00000000000c'),
  '23514', null, 'voice messages must be in the author''s own folder');
select throws_ok(
  $$insert into public.workout_comments (workout_id, audio_path, audio_duration_ms)
    values ((select id from ana_workout), '00000000-0000-0000-0000-00000000000b/comments/x/2.m4a', 45000)$$,
  '23514', null, 'voice messages are capped at 30 seconds');
select throws_ok(
  $$insert into public.workout_comments (workout_id, body) values ((select id from ana_workout), '   ')$$,
  '23514', null, 'empty comments are rejected');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok(
  $$insert into public.workout_comments (workout_id, body) values ((select id from ana_workout), 'hi')$$,
  '42501', null, 'strangers cannot comment');

-- ─── Notifications ───────────────────────────────────────────────────────────

reset role;
select bag_eq(
  $$select user_id, title, body, url from public.notifications$$,
  $$values
    ('00000000-0000-0000-0000-00000000000a'::uuid, 'Ben commented on your run 💬'::text,
     '“Strong run! Keep it up 💪”'::text, '/workout/' || (select id from ana_workout)),
    ('00000000-0000-0000-0000-00000000000a'::uuid, 'Ben sent you a voice message 🎙️'::text,
     '🎙️ Voice message (0:12)'::text, '/workout/' || (select id from ana_workout))$$,
  'the workout owner is notified of comments and voice messages');

delete from public.notifications;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.workout_comments (workout_id, body) values ((select id from ana_workout), 'Thanks Ben!');
reset role;
select results_eq(
  $$select user_id, title from public.notifications$$,
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid, 'Ana replied on their run 💬'::text)$$,
  'an owner''s reply notifies earlier commenters');

delete from public.notifications;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.workout_comments (workout_id, body) values ((select id from ana_workout), 'Nice pace');
reset role;
select results_eq(
  $$select user_id, title from public.notifications$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid, 'Cat commented on your run 💬'::text)$$,
  'earlier commenters who can''t see the new comment (not partners of its author) are not notified');

delete from public.notifications;
update public.profiles set notify_comments = false where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.workout_comments (workout_id, body) values ((select id from ana_workout), 'One more');
reset role;
select is((select count(*) from public.notifications), 0::bigint,
  'comment pushes respect the notify_comments setting');

-- ─── Reading ─────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.workout_comments), 5::bigint,
  'the owner sees every comment on their workout');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select bag_eq(
  $$select coalesce(body, '(voice)') from public.workout_comments$$,
  $$values ('Strong run! Keep it up 💪'::text), ('(voice)'::text), ('Thanks Ben!'::text), ('One more'::text)$$,
  'partners see their own comments and the owner''s, not comments from people they aren''t partnered with');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select is((select count(*) from public.workout_comments), 0::bigint, 'strangers see no comments');

-- ─── Deleting ────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
delete from public.workout_comments where body = 'Strong run! Keep it up 💪';
reset role;
select is((select count(*) from public.workout_comments where body = 'Strong run! Keep it up 💪'), 1::bigint,
  'you cannot delete someone else''s comment on someone else''s workout');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
delete from public.workout_comments where body = 'One more';
reset role;
select is((select count(*) from public.workout_comments where body = 'One more'), 0::bigint,
  'authors can delete their own comments');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
delete from public.workout_comments where body = 'Nice pace';
reset role;
select is((select count(*) from public.workout_comments where body = 'Nice pace'), 0::bigint,
  'owners can delete comments on their workout');

delete from public.workouts where id = (select id from ana_workout);
select is((select count(*) from public.workout_comments), 0::bigint,
  'deleting a workout deletes its comments');

select * from finish();
rollback;
