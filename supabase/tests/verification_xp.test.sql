-- Verifying a partner's workout earns XP on both sides. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.xp(p_user uuid, p_kind text) returns bigint language sql as $$
  select coalesce(sum(amount), 0) from public.xp_events where user_id = p_user and kind = p_kind;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@example.com', '{"full_name": "Ben"}'),
  ('00000000-0000-0000-0000-00000000000c', 'cy@example.com', '{"full_name": "Cy"}');
insert into public.partnerships (requester_id, addressee_id, status, accepted_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted', now()),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'accepted', now());

-- Five of Ana's hand-logged workouts from this morning.
insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
select '00000000-0000-0000-0000-00000000000a', 'manual', 'running',
       now() - make_interval(hours => 6 - n), now() - make_interval(hours => 6 - n) + interval '20 min', 1200
from generate_series(1, 5) n;
create temp table ana_w as
  select id, row_number() over (order by started_at) as n from public.workouts
  where user_id = '00000000-0000-0000-0000-00000000000a';
grant select on ana_w to authenticated;

-- Ben verifies the first one.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.reactions (workout_id, kind) select id, 'verified' from ana_w where n = 1;
reset role;

select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a', 'verified'), 5::bigint,
  'a verified workout earns its owner +5 XP');
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b', 'verifier'), 2::bigint,
  'verifying earns the partner +2 XP');

-- Cy verifies the same workout: Ana's +5 is once per workout.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.reactions (workout_id, kind) select id, 'verified' from ana_w where n = 1;
reset role;
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a', 'verified'), 5::bigint,
  'the owner earns +5 once per workout, however many partners verify it');

-- Ben verifies the other four the same day: only three verifications a day earn XP.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.reactions (workout_id, kind) select id, 'verified' from ana_w where n > 1;
reset role;
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b', 'verifier'), 6::bigint,
  'verifying earns XP for up to three workouts a day');
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a', 'verified'), 25::bigint,
  'each verified workout earns its owner +5');

-- Ben removes his ✅ from the first workout.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
delete from public.reactions where kind = 'verified' and workout_id = (select id from ana_w where n = 1);
reset role;
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b', 'verifier'), 4::bigint,
  'un-verifying takes back the verifier''s XP');
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a', 'verified'), 25::bigint,
  'the owner keeps +5 while another partner''s ✅ remains');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
delete from public.reactions where kind = 'verified' and workout_id = (select id from ana_w where n = 1);
reset role;
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a', 'verified'), 20::bigint,
  'the owner''s +5 goes when no ✅ remains');

select * from finish();
rollback;
