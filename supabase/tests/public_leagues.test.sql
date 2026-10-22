-- Public leagues: opt in, weekly groups, promotion and demotion. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.u(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;

-- n XP right now, as postgres (the way the server awards it).
create function pg_temp.give_xp(p_user uuid, p_amount int, p_ref text default null) returns void language sql as $$
  insert into public.xp_events (user_id, kind, ref, amount)
  values (p_user, 'week_goal', coalesce(p_ref, gen_random_uuid()::text), p_amount);
$$;

create function pg_temp.opt_in(p_user uuid, p_nickname text default null) returns void language plpgsql as $$
begin
  perform pg_temp.act_as(p_user);
  perform public.set_public_league(true, p_nickname);
  reset role;
end;
$$;

-- 25 players in New York, 1 in Tokyo, 1 who never opts in.
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.u(n), 'p' || n || '@example.com', json_build_object('full_name', 'Player ' || n)
from generate_series(1, 27) n;
update public.profiles set timezone = 'America/New_York' where id <> pg_temp.u(26);
update public.profiles set timezone = 'Asia/Tokyo' where id = pg_temp.u(26);

-- ─── Joining ─────────────────────────────────────────────────────────────────

select pg_temp.opt_in(pg_temp.u(1), 'Speedy');
select is((select count(*) from public.league_members), 0::bigint, 'opting in with no XP this week joins no group yet');

select pg_temp.give_xp(pg_temp.u(1), 50);
select is((select count(*) from public.league_members where user_id = pg_temp.u(1)), 1::bigint,
  'earning XP puts you in this week’s group');

select pg_temp.give_xp(pg_temp.u(27), 50);
select is((select count(*) from public.league_members where user_id = pg_temp.u(27)), 0::bigint,
  'people who never opted in are never placed');

-- Players 2–21 earn XP first, then opt in (joining straight away).
select pg_temp.give_xp(pg_temp.u(n), 10 * n) from generate_series(2, 21) n;
select pg_temp.opt_in(pg_temp.u(n)) from generate_series(2, 21) n;
select results_eq(
  $$select count(*)::int from public.league_members group by cohort_id order by 1 desc$$,
  $$values (20), (1)$$,
  'groups hold at most 20; the 21st player starts a new one');

select pg_temp.opt_in(pg_temp.u(26));
select pg_temp.give_xp(pg_temp.u(26), 30);
select isnt(
  (select cohort_id from public.league_members where user_id = pg_temp.u(26)),
  (select cohort_id from public.league_members where user_id = pg_temp.u(1)),
  'players in far-apart time zones get separate groups');
select is((select tier from public.league_cohorts c join public.league_members m on m.cohort_id = c.id
           where m.user_id = pg_temp.u(1)), 1::smallint, 'everyone starts in tier 1');

-- ─── What you can see ────────────────────────────────────────────────────────

select pg_temp.act_as(pg_temp.u(1));
select is((select count(*) from public.my_public_league()), 20::bigint, 'you see your whole group');
select is((select name from public.my_public_league() where is_me), 'Speedy', 'your nickname is shown instead of your name');
select is((select name from public.my_public_league() where not is_me order by rank limit 1), 'Player',
  'others show first names only');
select ok(not exists (select 1 from public.my_public_league() where member_key like '00000000%'),
  'strangers are identified by a key, not their user id');
select is((select rank from public.my_public_league() where is_me), 16,
  'ranked by this week’s XP');
select throws_ok($$select * from public.league_members$$, '42501', null,
  'group membership is not readable directly');
select throws_ok($$select public.league_join(auth.uid())$$, '42501', null,
  'clients cannot place themselves');
reset role;

-- ─── Fairness ────────────────────────────────────────────────────────────────

-- Player 22: a 30-minute hand-logged workout without a photo earns 25 XP, which counts 12 in leagues.
select pg_temp.opt_in(pg_temp.u(22));
insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
values (pg_temp.u(22), 'manual', 'running', now() - interval '1 hour', now() - interval '30 min', 1800);
select is(public.league_xp(pg_temp.u(22), public.league_week(pg_temp.u(22))), 12,
  'hand-logged workouts without a photo count half in public leagues');

-- ─── Reports and leaving ─────────────────────────────────────────────────────

select pg_temp.act_as(pg_temp.u(1));
select lives_ok(
  $$select public.report_league_member((select member_key from public.my_public_league() where not is_me limit 1), 'spam')$$,
  'you can report someone in your group');
select throws_ok(
  $$select public.report_league_member((select member_key from public.my_public_league() where is_me), null)$$,
  'P0002', null, 'you cannot report yourself');
reset role;

select pg_temp.act_as(pg_temp.u(21));
select public.set_public_league(false);
reset role;
select is((select count(*) from public.league_members where user_id = pg_temp.u(21)), 0::bigint,
  'opting out leaves this week’s group');

-- ─── End of the week ─────────────────────────────────────────────────────────

-- Player 2 is in tier 2 already and earns nothing more; give the big group a second-tier member.
update public.league_players set tier = 2 where user_id = pg_temp.u(20);

select is(public.close_league_weeks(now()), 0, 'groups stay open until the week is over everywhere');
select ok(public.close_league_weeks(now() + interval '8 days') >= 2, 'finished weeks close');

-- The big group had 20 players: top 5 move up, nobody in tier 1 moves down.
select results_eq(
  $$select user_id, result from public.league_members
    where cohort_id = (select cohort_id from public.league_members where user_id = pg_temp.u(1))
      and result = 'up' order by final_rank$$,
  $$select pg_temp.u(n), 'up'::text from generate_series(20, 16, -1) n$$,
  'the top 5 of a full group move up');
select is((select tier from public.league_players where user_id = pg_temp.u(19)), 2::smallint,
  'moving up raises your tier for next week');

select pg_temp.act_as(pg_temp.u(19));
select results_eq($$select result, tier from public.my_league_result()$$, $$values ('up'::text, 2::smallint)$$,
  'you find out how your week went');
select public.mark_league_result_seen();
select is((select count(*) from public.my_league_result()), 0::bigint, 'and only once');
reset role;

select * from finish();
rollback;
