-- Invite rewards: +100 XP each when someone new you invited works out. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.invite_xp(p_user uuid) returns bigint language sql as $$
  select coalesce(sum(amount), 0) from public.xp_events where user_id = p_user and kind = 'invite';
$$;

create function pg_temp.workout(p_user uuid) returns void language sql as $$
  insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
  values (p_user, 'manual', 'running', now() - interval '1 hour', now() - interval '30 min', 1800);
$$;

-- Ana has used Sigamos for months; Ben and Cy are new; Dee is an old account.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@example.com', '{"full_name": "Ben"}'),
  ('00000000-0000-0000-0000-00000000000c', 'cy@example.com', '{"full_name": "Cy"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@example.com', '{"full_name": "Dee"}');
update public.profiles set created_at = now() - interval '90 days'
where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d');
-- Read as the owner: a stranger can't see Ana's profile, only use her code.
create temp table ana as select invite_code from public.profiles where id = '00000000-0000-0000-0000-00000000000a';
grant select on ana to authenticated;

-- Ben opens Ana's invite link.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.request_partner((select invite_code from ana));
reset role;
select is((select inviter_id from public.invites where invitee_id = '00000000-0000-0000-0000-00000000000b'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'a new account using your code counts as your invite');

-- Ben works out before Ana accepts: nothing yet.
select pg_temp.workout('00000000-0000-0000-0000-00000000000b');
select is(pg_temp.invite_xp('00000000-0000-0000-0000-00000000000a'), 0::bigint,
  'no reward until the partnership is accepted');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.respond_to_partner(
  (select id from public.partnerships where requester_id = '00000000-0000-0000-0000-00000000000b'), true);
reset role;
select is(pg_temp.invite_xp('00000000-0000-0000-0000-00000000000a'), 100::bigint,
  'accepting after their first workout pays the inviter 100 XP');
select is(pg_temp.invite_xp('00000000-0000-0000-0000-00000000000b'), 100::bigint, 'and the new person 100 XP');

select pg_temp.workout('00000000-0000-0000-0000-00000000000b');
select is(pg_temp.invite_xp('00000000-0000-0000-0000-00000000000a'), 100::bigint, 'only once per person');

-- Cy joins with Ana's code, Ana accepts, then Cy works out.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.request_partner((select invite_code from ana));
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.respond_to_partner(
  (select id from public.partnerships where requester_id = '00000000-0000-0000-0000-00000000000c'), true);
reset role;
select is(pg_temp.invite_xp('00000000-0000-0000-0000-00000000000c'), 0::bigint, 'no reward before a workout');
select pg_temp.workout('00000000-0000-0000-0000-00000000000c');
select is(pg_temp.invite_xp('00000000-0000-0000-0000-00000000000a'), 200::bigint,
  'a workout after accepting pays out too');

-- Dee is an old account: partnering up isn't an invite.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select public.request_partner((select invite_code from ana));
reset role;
select is((select count(*) from public.invites where invitee_id = '00000000-0000-0000-0000-00000000000d'), 0::bigint,
  'existing accounts partnering up don’t count as invites');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.award_invite_xp(auth.uid())$$, '42501', null, 'clients cannot award themselves');
reset role;

select * from finish();
rollback;
