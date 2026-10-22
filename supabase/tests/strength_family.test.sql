-- A "Strength" incentive counts traditional, functional and core strength workouts. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(5);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- A 30-minute workout `p_day` days into the latest incentive's window.
create function pg_temp.workout(p_user uuid, p_day int, p_type text) returns void language sql as $$
  insert into public.workouts (user_id, source, external_id, activity_type, started_at, ended_at, duration_s)
  select p_user, 'healthkit', gen_random_uuid()::text, p_type,
         i.starts_at + make_interval(days => p_day, hours => 9),
         i.starts_at + make_interval(days => p_day, hours => 9, mins => 30), 1800
  from public.incentives i order by created_at desc limit 1;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'tony@example.com', '{"full_name": "Tony"}'),
  ('00000000-0000-0000-0000-00000000000b', 'sharon@example.com', '{"full_name": "Sharon"}');
update public.profiles set onboarded_at = now();
insert into public.partnerships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

select ok(public.activity_matches('traditionalStrengthTraining', 'functionalStrengthTraining'),
  'Strength matches functional strength');
select ok(not public.activity_matches('running', 'walking'), 'other goals still match one type');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
create temp table offer as
  select * from public.offer_incentive('00000000-0000-0000-0000-00000000000b', 'workouts', 6, 2, 'Massage', '💆',
    'traditionalStrengthTraining');
reset role;
grant select on offer to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.respond_to_incentive((select id from offer), true);
reset role;

select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 0, 'functionalStrengthTraining');
select is((select progress from public.incentives), 1, 'a functional strength workout counts toward a Strength goal');

select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 1, 'coreTraining');
select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 2, 'traditionalStrengthTraining');
select is((select progress from public.incentives), 3, 'core and traditional strength count too');

select pg_temp.workout('00000000-0000-0000-0000-00000000000b', 3, 'walking');
select is((select progress from public.incentives), 3, 'a walk does not count toward a Strength goal');

select * from finish();
rollback;
