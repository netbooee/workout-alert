-- Account deletion. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bo@example.com', '{"full_name": "Bo"}');
update public.profiles set onboarded_at = now();

insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s) values
  ('00000000-0000-0000-0000-00000000000a', 'manual', 'running', now() - interval '1 hour', now() - interval '30 minutes', 1800),
  ('00000000-0000-0000-0000-00000000000b', 'manual', 'running', now() - interval '1 hour', now() - interval '30 minutes', 1800);

-- Ana and Bo are partners.
create temp table codes as select id, invite_code from public.profiles;
grant select on codes to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.request_partner((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000b'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.request_partner((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000a'));
reset role;
select is((select count(*) from public.partnerships where status = 'accepted'), 1::bigint, 'Ana and Bo are partners');

-- Signed-out callers can't use it.
set local role anon;
select throws_ok('select public.delete_my_account()', '42501', null, 'anon cannot call delete_my_account');
reset role;

-- Ana deletes her account.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok('select public.delete_my_account()', 'a signed-in user can delete their account');
reset role;

select is((select count(*) from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 0::bigint,
  'the auth user is gone');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 0::bigint,
  'the profile is gone');
select is(
  (select count(*) from public.workouts where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.partnerships), 0::bigint,
  'her workouts and partnerships are gone');
select is((select count(*) from public.workouts where user_id = '00000000-0000-0000-0000-00000000000b'), 1::bigint,
  'her partner keeps their own data');

select * from finish();
rollback;
