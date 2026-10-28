-- Profile photos: own folder only, visible to connected people. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- Alex and Blair are partners; Casey is a stranger to both.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex"}'),
  ('00000000-0000-0000-0000-00000000000b', 'blair@example.com', '{"full_name": "Blair"}'),
  ('00000000-0000-0000-0000-00000000000c', 'casey@example.com', '{"full_name": "Casey"}');
insert into public.partnerships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

-- Files as the Storage API would write them.
insert into storage.objects (bucket_id, name) values
  ('avatars', '00000000-0000-0000-0000-00000000000a/avatar-1.jpg'),
  ('avatars', '00000000-0000-0000-0000-00000000000c/avatar-1.jpg');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ update public.profiles set avatar_url = '00000000-0000-0000-0000-00000000000a/avatar-1.jpg'
     where id = '00000000-0000-0000-0000-00000000000a' $$,
  'you can point your profile at a photo in your own folder');

select throws_ok(
  $$ update public.profiles set avatar_url = '00000000-0000-0000-0000-00000000000c/avatar-1.jpg'
     where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null,
  'not at someone else''s photo');

select throws_ok(
  $$ update public.profiles set avatar_url = 'https://example.com/me.jpg'
     where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null,
  'and not at an outside link');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '00000000-0000-0000-0000-00000000000b/avatar-2.jpg') $$,
  '42501', null,
  'you can''t upload into someone else''s folder');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select is(
  (select avatar_url from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  '00000000-0000-0000-0000-00000000000a/avatar-1.jpg',
  'a partner sees your photo path');

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'avatars' and name like '00000000-0000-0000-0000-00000000000a/%'),
  1,
  'and can read the photo itself');

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'avatars' and name like '00000000-0000-0000-0000-00000000000c/%'),
  0,
  'a stranger''s photo stays hidden');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'avatars' and name like '00000000-0000-0000-0000-00000000000a/%'),
  0,
  'and strangers can''t read yours');

select * from finish();
rollback;
