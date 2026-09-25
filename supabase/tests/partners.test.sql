-- Partners, evidence reactions, nudges, XP, league, friend streaks. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(33);

-- Fixed clock: Thursday 2026-09-24 12:00 UTC. Current week starts Mon 09-21.
create temp table t_now as select '2026-09-24 12:00:00+00'::timestamptz as ts;
grant select on t_now to authenticated;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.add_workout(p_user uuid, p_start timestamptz, p_minutes int)
returns uuid language sql as $$
  insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
  values (p_user, 'manual', 'running', p_start, p_start + make_interval(mins => p_minutes), p_minutes * 60)
  returning id;
$$;

create function pg_temp.xp(p_user uuid, p_kind text) returns bigint language sql as $$
  select coalesce(sum(amount), 0) from public.xp_events where user_id = p_user and kind = p_kind;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex"}'),
  ('00000000-0000-0000-0000-00000000000b', 'blair@example.com', '{"full_name": "Blair"}'),
  ('00000000-0000-0000-0000-00000000000c', 'casey@example.com', '{"full_name": "Casey"}');

create temp table codes as select id, invite_code from public.profiles;
grant select on codes to authenticated;

select ok((select bool_and(invite_code ~ '^[A-HJKMNP-Z2-9]{6}$') from codes),
  'every profile gets a 6-character invite code');

-- Blair already has a workout before Alex connects.
create temp table b_workout as
  select pg_temp.add_workout('00000000-0000-0000-0000-00000000000b', '2026-09-22 07:00Z', 30) as id;
grant select on b_workout to authenticated;

-- ─── Requests ────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select is(
  (public.request_partner(lower((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000b')))).status,
  'pending', 'requesting by invite code (any case) creates a pending request');
select is((select count(*) from public.profiles), 2::bigint,
  'a pending request reveals the other person''s profile');
select is((select count(*) from public.workouts), 0::bigint,
  'pending partners cannot see each other''s workouts');
select throws_ok(
  $$select public.request_partner((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000a'))$$,
  '22023', 'That is your own invite code', 'you cannot partner with yourself');
select throws_ok($$select public.request_partner('ZZZZZZ')$$, 'P0002', null, 'unknown codes are rejected');
select throws_ok(
  $$select public.respond_to_partner((select id from public.partnerships limit 1), true)$$,
  'P0002', null, 'the requester cannot accept their own request');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$select public.respond_to_partner((select id from public.partnerships limit 1), true)$$,
  'the addressee accepts the request');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.workouts), 1::bigint,
  'accepted partners can see each other''s workouts');
select is((select count(*) from public.streaks where user_id = '00000000-0000-0000-0000-00000000000b'), 1::bigint,
  'accepted partners can see each other''s streaks');

-- Casey asks Alex; Alex entering Casey's code accepts instead of duplicating.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.request_partner((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000a'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is(
  (public.request_partner((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000c'))).status,
  'accepted', 'requesting someone who already asked you accepts their request');
reset role;
select is((select count(*) from public.partnerships), 2::bigint, 'no duplicate partnership is created');

-- Blair and Casey are not partners.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*) from public.workouts where user_id = '00000000-0000-0000-0000-00000000000b'), 0::bigint,
  'non-partners cannot see workouts');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 0::bigint,
  'non-partners cannot see profiles');

-- ─── Reactions ───────────────────────────────────────────────────────────────

select throws_ok(
  $$insert into public.reactions (workout_id, kind) values ((select id from b_workout), 'fire')$$,
  '42501', null, 'non-partners cannot react');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$insert into public.reactions (workout_id, kind) values ((select id from b_workout), 'verified')$$,
  'partners can verify a workout');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$insert into public.reactions (workout_id, kind) values ((select id from b_workout), 'verified')$$,
  '42501', null, 'you cannot verify your own workout');
select is((select count(*) from public.reactions), 1::bigint, 'owners see reactions on their workouts');

-- ─── Nudges ──────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.nudge_partner('00000000-0000-0000-0000-00000000000b')$$, 'partners can nudge');
select throws_ok($$select public.nudge_partner('00000000-0000-0000-0000-00000000000b')$$,
  'P0001', 'You already nudged them recently', 'nudges are rate limited');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.nudge_partner('00000000-0000-0000-0000-00000000000c')$$,
  '42501', null, 'non-partners cannot be nudged');

-- ─── XP ──────────────────────────────────────────────────────────────────────

reset role;
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b', 'workout'), 25::bigint,
  'a 30-minute workout earns 25 XP');

create temp table a_short as
  select pg_temp.add_workout('00000000-0000-0000-0000-00000000000a', '2026-09-22 07:00Z', 3) as id;
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a', 'workout'), 0::bigint,
  'workouts under 5 minutes earn nothing');

update public.workouts set photo_paths = '{"b/x/1.jpg"}' where id = (select id from b_workout);
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b', 'evidence'), 5::bigint,
  'adding photo evidence earns 5 XP');

update public.profiles set weekly_goal = 1 where id = '00000000-0000-0000-0000-00000000000b';
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b', 'week_goal'), 50::bigint,
  'hitting the weekly goal earns 50 XP');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select display_name, xp from public.weekly_league((select ts from t_now))$$,
  $$values ('Blair'::text, 80), ('Alex'::text, 0), ('Casey'::text, 0)$$,
  'the weekly league ranks you and your partners by XP');

reset role;
delete from public.workouts where id = (select id from b_workout);
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b', 'workout')
        + pg_temp.xp('00000000-0000-0000-0000-00000000000b', 'evidence')
        + pg_temp.xp('00000000-0000-0000-0000-00000000000b', 'week_goal'), 0::bigint,
  'deleting a workout takes back its XP and any week-goal bonus it earned');

-- ─── Friend streaks ──────────────────────────────────────────────────────────
-- Alex and Blair (goal 1/week) both work out in weeks 09-07, 09-14, and 09-21.

update public.profiles set weekly_goal = 1 where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.add_workout(u, d, 30)
from unnest(array['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b']::uuid[]) as u,
     unnest(array['2026-09-08 12:00Z', '2026-09-15 12:00Z', '2026-09-22 12:00Z']::timestamptz[]) as d;
select public.recompute_streak(u, (select ts from t_now))
from unnest(array['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b']::uuid[]) as u;

select is(public.friend_streak('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
  '2026-09-01', (select ts from t_now)), 3, 'weeks where both partners hit their goals build a friend streak');
select is(public.friend_streak('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
  '2026-09-16', (select ts from t_now)), 2, 'the friend streak starts from when you became partners');

delete from public.workouts
where user_id = '00000000-0000-0000-0000-00000000000b' and started_at = '2026-09-15 12:00Z';
select public.recompute_streak('00000000-0000-0000-0000-00000000000b', (select ts from t_now));
select is(public.friend_streak('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
  '2026-09-01', (select ts from t_now)), 1, 'either partner missing a week breaks the friend streak');

-- ─── Partner list ────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select display_name, status, incoming from public.my_partners()$$,
  $$values ('Blair'::text, 'accepted'::text, false), ('Casey'::text, 'accepted'::text, false)$$,
  'my_partners lists accepted partners');
select isnt((select last_nudged_at from public.my_partners() where display_name = 'Blair'), null,
  'my_partners shows when you last nudged someone');

reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'dana@example.com');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select public.request_partner((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000a'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select incoming from public.my_partners() where status = 'pending'), true,
  'incoming requests are flagged for the addressee');

select * from finish();
rollback;
