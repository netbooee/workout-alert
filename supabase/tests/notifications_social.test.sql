-- Pushes for partner requests, acceptances, and verified workouts. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.code(p_user uuid) returns text language sql security definer as $$
  select invite_code from public.profiles where id = p_user;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex Kim"}'),
  ('00000000-0000-0000-0000-00000000000b', 'blair@example.com', '{"full_name": "Blair Fox"}'),
  ('00000000-0000-0000-0000-00000000000c', 'casey@example.com', '{"full_name": "Casey Li"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dana@example.com', '{"full_name": "Dana Ro"}');
insert into public.push_tokens (token, user_id) values
  ('ExponentPushToken[alex]', '00000000-0000-0000-0000-00000000000a'),
  ('ExponentPushToken[blair]', '00000000-0000-0000-0000-00000000000b');

-- ─── Requests ────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.request_partner(pg_temp.code('00000000-0000-0000-0000-00000000000a'));
reset role;

select results_eq(
  $$select user_id, kind, title, url from public.notifications$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid, 'partner_request'::text,
            'Blair wants to be your accountability partner 🤝'::text, '/partners'::text)$$,
  'a partner request notifies only the person asked');
select is(
  (select jsonb_array_elements(convert_from(body, 'utf8')::jsonb) ->> 'to' from net.http_request_queue),
  'ExponentPushToken[alex]', 'the request is pushed to their device');

delete from public.notifications;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.respond_to_partner((select id from public.partnerships limit 1), true);
reset role;
select results_eq(
  $$select user_id, kind, title from public.notifications$$,
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid, 'partner_accepted'::text,
            'Alex accepted your partner request 🤝'::text)$$,
  'accepting notifies the person who asked');

-- Casey asks Alex; Alex entering Casey's code auto-accepts and notifies Casey.
delete from public.notifications;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.request_partner(pg_temp.code('00000000-0000-0000-0000-00000000000a'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.request_partner(pg_temp.code('00000000-0000-0000-0000-00000000000c'));
reset role;
select set_eq(
  $$select user_id, kind from public.notifications$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid, 'partner_request'::text),
           ('00000000-0000-0000-0000-00000000000c'::uuid, 'partner_accepted'::text)$$,
  'mutual requests notify the original requester that it was accepted');

-- Dana asks Alex, who declines: no "accepted" push for Dana.
delete from public.notifications;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select public.request_partner(pg_temp.code('00000000-0000-0000-0000-00000000000a'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.respond_to_partner(
  (select id from public.partnerships where requester_id = '00000000-0000-0000-0000-00000000000d'), false);
reset role;
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000000d'),
  0::bigint, 'declining does not notify the requester');

-- Opting out of request notifications.
delete from public.notifications;
update public.profiles set notify_partner_requests = false where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select public.request_partner(pg_temp.code('00000000-0000-0000-0000-00000000000a'));
reset role;
select is((select count(*) from public.notifications), 0::bigint,
  'request notifications can be turned off');

-- ─── Verified workouts ───────────────────────────────────────────────────────

delete from public.notifications;
create temp table w (id uuid);
with ins as (
  insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
  values ('00000000-0000-0000-0000-00000000000a', 'healthkit', 'running',
          now() - interval '3 days 42 minutes', now() - interval '3 days', 2520)
  returning id
)
insert into w select id from ins;
grant select on w to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.reactions (workout_id, kind) values ((select id from w), 'fire');
reset role;
select is((select count(*) from public.notifications), 0::bigint, 'ordinary reactions do not push');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.reactions (workout_id, kind) values ((select id from w), 'verified');
reset role;
select results_eq(
  $$select user_id, kind, title, body, url from public.notifications$$,
  format($$values ('00000000-0000-0000-0000-00000000000a'::uuid, 'verified'::text,
            'Blair verified your run ✅'::text, 'Your 42-min run is verified. Nice work!'::text,
            '/workout/%s'::text)$$, (select id from w)),
  'verifying a workout notifies its owner');

-- Un-verify and re-verify: still just one push.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
delete from public.reactions where kind = 'verified';
insert into public.reactions (workout_id, kind) values ((select id from w), 'verified');
reset role;
select is((select count(*) from public.notifications), 1::bigint,
  'toggling verify off and on does not push again');

-- A second partner verifying is new news.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.reactions (workout_id, kind) values ((select id from w), 'verified');
reset role;
select is((select count(*) from public.notifications), 2::bigint,
  'each partner who verifies sends one push');
select is((select title from public.notifications where title like 'Casey%'), 'Casey verified your run ✅',
  'the push names who verified');

-- Opting out of verification notifications.
update public.profiles set notify_verifications = false where id = '00000000-0000-0000-0000-00000000000a';
delete from public.notifications;
delete from public.reactions;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.reactions (workout_id, kind) values ((select id from w), 'verified');
reset role;
select is((select count(*) from public.notifications), 0::bigint,
  'verification notifications can be turned off');

-- ─── Existing kinds still work ───────────────────────────────────────────────

select lives_ok(
  $$insert into public.nudges (from_id, to_id)
    values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a')$$,
  'nudge notifications still insert under the widened kind check');
select is((select kind from public.notifications), 'nudge', 'nudges still notify');

select * from finish();
rollback;
