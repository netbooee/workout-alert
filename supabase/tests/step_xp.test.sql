-- Daily steps earn tiered bonus XP. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.steps_xp(p_day date) returns bigint language sql as $$
  select coalesce(sum(amount), 0) from public.xp_events
  where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'steps' and ref like p_day::text || ':%';
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}');
update public.profiles set created_at = '2026-09-01', timezone = 'America/New_York'
where id = '00000000-0000-0000-0000-00000000000a';

-- Ana's phone syncs her steps through the day.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.daily_activity (day, steps) values ('2026-10-23', 4999);
reset role;
select is(pg_temp.steps_xp('2026-10-23'), 0::bigint, 'under 5,000 steps earns nothing');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.daily_activity set steps = 5000 where day = '2026-10-23';
reset role;
select is(pg_temp.steps_xp('2026-10-23'), 5::bigint, '5,000 steps earns 5 XP');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.daily_activity set steps = 9100 where day = '2026-10-23';
reset role;
select is(pg_temp.steps_xp('2026-10-23'), 15::bigint, '8,000 steps adds 10 more');
select results_eq(
  $$select ref from public.xp_events where kind = 'steps' order by ref$$,
  $$values ('2026-10-23:5000'::text), ('2026-10-23:8000')$$,
  'each tier is its own XP event, so each can be celebrated');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.daily_activity set steps = 30000 where day = '2026-10-23';
reset role;
select is(pg_temp.steps_xp('2026-10-23'), 25::bigint, 'a day tops out at 25 XP');

-- Re-syncing the same count changes nothing; a correction downward takes tiers back.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.daily_activity set active_kcal = 400 where day = '2026-10-23';
update public.daily_activity set steps = 7000 where day = '2026-10-23';
reset role;
select is(pg_temp.steps_xp('2026-10-23'), 5::bigint, 'fewer steps after a correction takes back tiers');

-- Upserts (how the app syncs) work the same way.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.daily_activity (day, steps) values ('2026-10-24', 12500)
on conflict (user_id, day) do update set steps = excluded.steps;
reset role;
select is(pg_temp.steps_xp('2026-10-24'), 25::bigint, 'a synced upsert earns its tiers');

-- History from before step XP existed earns nothing.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.daily_activity (day, steps) values ('2026-10-20', 15000);
reset role;
select is(pg_temp.steps_xp('2026-10-20'), 0::bigint, 'days before step XP launched earn nothing');

-- A past day's XP is dated on that day (her time), for the league week.
select ok(
  (select bool_and((created_at at time zone 'America/New_York')::date <= x.ref::date + 0)
   from (select created_at, split_part(ref, ':', 1) as ref from public.xp_events where kind = 'steps') x),
  'step XP is never dated after its day');

-- Steps never touch the streak.
select is((select count(*) from public.streak_weeks where user_id = '00000000-0000-0000-0000-00000000000a'), 0::bigint,
  'steps alone build no streak weeks');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.sync_step_xp('00000000-0000-0000-0000-00000000000a', '2026-10-25', 99999)$$,
  '42501', null, 'clients cannot award themselves step XP directly');
reset role;

select * from finish();
rollback;
