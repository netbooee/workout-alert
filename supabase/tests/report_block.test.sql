-- Report and block. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- Alex and Blair are partners.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex Smith"}'),
  ('00000000-0000-0000-0000-00000000000b', 'blair@example.com', '{"full_name": "Blair Jones"}');
insert into public.partnerships (requester_id, addressee_id, status, accepted_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted', now());

-- Blair comments on Alex's workout.
insert into public.workouts (id, user_id, source, activity_type, started_at, ended_at, duration_s) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'manual', 'running',
   now() - interval '2 hours', now() - interval '1 hour', 3600);
insert into public.workout_comments (id, workout_id, user_id, body) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-00000000000b', 'something rude');

create temp table codes as select id, invite_code from public.profiles;
grant select on codes to authenticated;

-- ─── Report ──────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ select public.report_content('00000000-0000-0000-0000-00000000000b', 'comment',
       '00000000-0000-0000-0000-0000000000c1', 'harassment') $$,
  'you can report a comment');
select throws_ok(
  $$ select public.report_content('00000000-0000-0000-0000-00000000000a', 'user', null, 'spam') $$,
  'P0001', null, 'but not yourself');
select throws_ok($$ select count(*) from public.content_reports $$, '42501', null,
  'reports are hidden from everyone in the app');

reset role;
select is((select snapshot from public.content_reports where kind = 'comment'), 'something rude',
  'a report keeps a copy of what was said');
select is((select reported_id from public.content_reports where kind = 'comment'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'and who said it');

-- ─── Block ───────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.block_user('00000000-0000-0000-0000-00000000000b') $$, 'you can block someone');

reset role;
select is((select count(*)::int from public.partnerships), 0, 'blocking ends the partnership');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select name from public.my_blocks()), 'Blair', 'you see who you''ve blocked, by first name');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.blocks), 0, 'the blocked person can''t see the block');
select throws_ok(
  $$ select public.request_partner((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000a')) $$,
  'P0001', 'You can''t connect with this person.', 'or send a new partner request');

reset role;
select throws_ok(
  $$ insert into public.pep_talks (from_id, to_id, media_kind, media_path)
     values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'photo',
             '00000000-0000-0000-0000-00000000000b/pep-1.jpg') $$,
  'P0001', null, 'or a pep talk');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.unblock_user('00000000-0000-0000-0000-00000000000b') $$, 'you can unblock');
reset role;
select is((select count(*)::int from public.partnerships), 0, 'unblocking doesn''t restore the partnership');

select * from finish();
rollback;
