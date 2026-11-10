-- Private groups: membership rules, privacy, leaderboard, squad streak and
-- notifications. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(28);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- Five people in UTC; none are partners.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex Smith"}'),
  ('00000000-0000-0000-0000-00000000000b', 'blair@example.com', '{"full_name": "Blair"}'),
  ('00000000-0000-0000-0000-00000000000c', 'casey@example.com', '{"full_name": "Casey"}'),
  ('00000000-0000-0000-0000-00000000000d', 'drew@example.com', '{"full_name": "Drew"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eli@example.com', '{"full_name": "Eli"}');
update public.profiles set timezone = 'UTC';

create temp table g (id uuid, code text);
grant select, insert, delete on g to authenticated;

-- ─── Creating and joining ───────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ insert into g select id, invite_code from public.create_group('  Gym Rats  ', '🏋️') $$,
  'anyone can start a group');
select is((select name from public.groups where id = (select id from g)), 'Gym Rats', 'the name is trimmed');
select is(
  (select role from public.group_members where group_id = (select id from g)
   and user_id = '00000000-0000-0000-0000-00000000000a'),
  'owner', 'the creator owns it');
select throws_ok($$ select public.create_group('x') $$, 'P0001', null, 'names need 2 to 30 characters');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select name from public.group_preview((select code from g))), 'Gym Rats',
  'an invite shows the group before you join');
select is((select count(*)::int from public.groups), 0, 'but you can''t read it before joining');
select lives_ok($$ select public.join_group(lower((select code from g))) $$, 'the code joins you (any case)');
select lives_ok($$ select public.join_group((select code from g)) $$, 'joining twice is harmless');
select throws_ok($$ select public.join_group('ZZZZZZ') $$, 'P0002', null, 'a wrong code says so');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.join_group((select code from g));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select public.join_group((select code from g));

-- Drew is in 3 groups already, so a 4th is too many.
select public.create_group('Two'); select public.create_group('Three');
select throws_ok($$ select public.create_group('Four') $$, 'P0001', null, 'up to 3 groups each');

-- ─── Privacy ─────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.group_board((select id from g))), 0,
  'outsiders see nobody in a group');
select ok(not public.shares_group('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000a'),
  'and don''t share a group with its members');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.group_board((select id from g))), 4, 'members see all four');
select is(
  (select name from public.group_board((select id from g)) where user_id = '00000000-0000-0000-0000-00000000000a'),
  'Alex', 'by first name');
select is((select count(*)::int from public.workouts where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'but not each other''s workouts');

select throws_ok(
  $$ select public.remove_group_member((select id from g), '00000000-0000-0000-0000-00000000000c') $$,
  '42501', null, 'only the owner can remove people');

-- ─── Renaming ────────────────────────────────────────────────────────────────

-- Still Blair, a member.
select throws_ok(
  $$ select public.update_group((select id from g), 'Blair''s Gym', '💪') $$,
  '42501', null, 'only the owner can rename the group or change its emoji');
-- Row level security has no update policy, so a direct edit quietly changes nothing.
update public.groups set name = 'Blair''s Gym' where id = (select id from g);
select is((select name from public.groups where id = (select id from g)), 'Gym Rats',
  'and editing the groups table directly changes nothing');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is(
  (select name || ' ' || emoji from public.update_group((select id from g), '  Gym Crew ', '💪')),
  'Gym Crew 💪', 'the owner can rename it (trimmed) and change its emoji');
select throws_ok(
  $$ select public.update_group((select id from g), 'x', '💪') $$,
  'P0001', null, 'a new name still needs 2 to 30 characters');

-- ─── Squad streak ────────────────────────────────────────────────────────────

reset role;
-- Four members need 4 (80% of 4, rounded up). Last week everyone made it, one by a freeze.
insert into public.streak_weeks (user_id, week_start, active_days, goal, status)
select u, public.week_of(current_date) - 7, 3, 3, s
from (values ('00000000-0000-0000-0000-00000000000a'::uuid, 'hit'),
             ('00000000-0000-0000-0000-00000000000b'::uuid, 'hit'),
             ('00000000-0000-0000-0000-00000000000c'::uuid, 'hit'),
             ('00000000-0000-0000-0000-00000000000d'::uuid, 'frozen')) v(u, s)
on conflict (user_id, week_start) do update set status = excluded.status;
update public.group_members set joined_at = now() - interval '20 days' where group_id = (select id from g);
update public.groups set created_at = now() - interval '20 days' where id = (select id from g);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select squad_streak from public.my_groups() where id = (select id from g)), 1,
  'a week everyone made (a freeze counts) adds to the squad streak');
select is((select need from public.my_groups() where id = (select id from g)), 4, 'groups of 4 need everyone');
select is(public.squad_need(10), 8, 'bigger groups need 80%');

-- ─── Notifications ──────────────────────────────────────────────────────────

reset role;
delete from public.notifications;
-- This week: three of four hit their goal, so the group is one short.
insert into public.streak_weeks (user_id, week_start, active_days, goal, status)
select u, public.week_of(current_date), 3, 3, 'hit'
from unnest(array['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b']::uuid[]) u
on conflict (user_id, week_start) do update set status = 'hit';
insert into public.streaks (user_id, current_weeks, this_week_days, this_week_goal)
values ('00000000-0000-0000-0000-00000000000c', 1, 3, 3)
on conflict (user_id) do update set this_week_days = 3, this_week_goal = 3;

select is(
  (select array_agg(user_id order by user_id) from public.notifications where kind = 'group'),
  array['00000000-0000-0000-0000-00000000000d']::uuid[],
  'when one more is needed, whoever''s left hears about it');

insert into public.streak_weeks (user_id, week_start, active_days, goal, status)
values ('00000000-0000-0000-0000-00000000000c', public.week_of(current_date), 3, 3, 'hit')
on conflict (user_id, week_start) do update set status = 'hit';
insert into public.streaks (user_id, current_weeks, this_week_days, this_week_goal)
values ('00000000-0000-0000-0000-00000000000d', 1, 3, 3)
on conflict (user_id) do update set this_week_days = 3, this_week_goal = 3;

select is(
  (select count(*)::int from public.notifications where kind = 'group' and title like '%made it this week!'),
  4, 'when the squad makes it, everyone hears');

update public.streaks set this_week_days = 2 where user_id = '00000000-0000-0000-0000-00000000000d';
update public.streaks set this_week_days = 3 where user_id = '00000000-0000-0000-0000-00000000000d';
select is(
  (select count(*)::int from public.notifications where kind = 'group' and title like '%made it this week!'),
  4, 'only once a week');

-- ─── Leaving ─────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.leave_group((select id from g));
reset role;
select is(
  (select user_id from public.group_members where group_id = (select id from g) and role = 'owner'),
  (select user_id from public.group_members where group_id = (select id from g) order by joined_at, user_id limit 1),
  'when the owner leaves, the longest-standing member takes over');

delete from public.group_members where group_id = (select id from g);
select is((select count(*)::int from public.groups where id = (select id from g)), 0,
  'an empty group is deleted');

select * from finish();
rollback;
