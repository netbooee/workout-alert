-- Picking a character, and partners seeing it. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex"}'),
  ('00000000-0000-0000-0000-00000000000b', 'blair@example.com', '{"full_name": "Blair"}'),
  ('00000000-0000-0000-0000-00000000000c', 'casey@example.com', '{"full_name": "Casey"}');

-- Alex and Blair are partners; Casey has only sent Alex a request.
insert into public.partnerships (requester_id, addressee_id, status, accepted_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted', now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a', 'pending', null);
update public.profiles set resting_since = now()
  where id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');

select is((select mascot from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'lotl',
  'everyone starts with Lotl');

-- Blair picks the sloth; Casey the capybara.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.profiles set mascot = 'sloth' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
update public.profiles set mascot = 'capybara' where id = '00000000-0000-0000-0000-00000000000c';

select throws_ok(
  $$update public.profiles set mascot = 'dragon' where id = '00000000-0000-0000-0000-00000000000c'$$,
  '23514', null, 'only known characters can be picked');

-- Casey can't change someone else's character.
update public.profiles set mascot = 'red_panda' where id = '00000000-0000-0000-0000-00000000000b';
reset role;
select is((select mascot from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'sloth',
  'you can only change your own character');
select is((select mascot from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), 'capybara',
  'you can change your own character');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select mascot from public.my_partners() where display_name = 'Blair'), 'sloth',
  'partners see your character');
select is((select resting from public.my_partners() where display_name = 'Blair'), true,
  'partners see when you are resting');
select is((select mascot from public.my_partners() where display_name = 'Casey'), 'capybara',
  'a pending request shows the requester''s character');
select is((select resting from public.my_partners() where display_name = 'Casey'), false,
  'rest mode is not shared before the request is accepted');
select is((select mascot from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'sloth',
  'a partner can read your character from your profile');

select * from finish();
rollback;
