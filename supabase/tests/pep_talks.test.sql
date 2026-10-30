-- Pep talks: partners only, own files, a daily limit, private to the pair. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- Alex and Blair are partners; Casey is a stranger to both.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex Smith"}'),
  ('00000000-0000-0000-0000-00000000000b', 'blair@example.com', '{"full_name": "Blair"}'),
  ('00000000-0000-0000-0000-00000000000c', 'casey@example.com', '{"full_name": "Casey"}');
insert into public.partnerships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

-- Alex's uploaded file, as the Storage API would write it.
insert into storage.objects (bucket_id, name) values
  ('pep-talks', '00000000-0000-0000-0000-00000000000a/pep-1.mp4');

create temp table sent (id uuid);
grant select, insert on sent to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ insert into sent select id from public.send_pep_talk(
       '00000000-0000-0000-0000-00000000000b', 'video',
       '00000000-0000-0000-0000-00000000000a/pep-1.mp4', '  You got this!  ') $$,
  'you can send a partner a video pep talk');

select is((select message from public.pep_talks where id = (select id from sent)), 'You got this!',
  'the message is trimmed');

select throws_ok(
  $$ select public.send_pep_talk('00000000-0000-0000-0000-00000000000c', 'photo',
       '00000000-0000-0000-0000-00000000000a/pep-2.jpg') $$,
  '42501', null, 'not to someone who isn''t your partner');

select throws_ok(
  $$ select public.send_pep_talk('00000000-0000-0000-0000-00000000000b', 'photo',
       '00000000-0000-0000-0000-00000000000c/pep-2.jpg') $$,
  '22023', null, 'not with someone else''s file');

select throws_ok(
  $$ select public.send_pep_talk('00000000-0000-0000-0000-00000000000b', 'photo',
       '00000000-0000-0000-0000-00000000000a/pep-2.mp4') $$,
  '22023', null, 'and the file has to match photo or video');

select lives_ok(
  $$ select public.send_pep_talk('00000000-0000-0000-0000-00000000000b', 'photo',
       '00000000-0000-0000-0000-00000000000a/pep-' || n || '.jpg') from generate_series(2, 5) n $$,
  'up to 5 a day');

select throws_ok(
  $$ select public.send_pep_talk('00000000-0000-0000-0000-00000000000b', 'photo',
       '00000000-0000-0000-0000-00000000000a/pep-6.jpg') $$,
  'P0001', null, 'a 6th the same day is too many');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select is(
  (select count(*)::int from public.pep_talks where to_id = '00000000-0000-0000-0000-00000000000b'),
  5, 'the partner sees the pep talks sent to them');

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'pep-talks' and name = '00000000-0000-0000-0000-00000000000a/pep-1.mp4'),
  1, 'and can open the video');

select public.mark_pep_talks_seen(array[(select id from sent)]);
select isnt((select seen_at from public.pep_talks where id = (select id from sent)), null,
  'the recipient can mark it seen');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');

select is((select count(*)::int from public.pep_talks), 0, 'strangers see no pep talks');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'pep-talks'),
  0, 'or their files');

reset role;

select is(
  (select title from public.notifications
   where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'pep_talk'
   order by created_at limit 1),
  'Alex sent you a pep talk 📣',
  'the recipient gets a notification');

select is(
  (select body from public.notifications
   where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'pep_talk'
     and url = '/pep-talk/' || (select id from sent)),
  'You got this!',
  'showing the message and opening the pep talk');

select * from finish();
rollback;
