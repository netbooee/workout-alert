-- Rest mode. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

-- Fixed clock: Thursday 2026-10-08. Weeks start 09-07, 09-14, 09-21, 09-28, 10-05.
create temp table t as select '2026-10-08 12:00+00'::timestamptz as now_ts;

create function pg_temp.workouts(p_user uuid, p_days text[]) returns void language sql as $$
  insert into public.workouts (user_id, source, activity_type, started_at, ended_at, duration_s)
  select p_user, 'manual', 'running', (d || ' 12:00+00')::timestamptz, (d || ' 12:30+00')::timestamptz, 1800
  from unnest(p_days) as d;
$$;

create function pg_temp.recompute(p_user uuid) returns public.streaks language sql as $$
  select public.recompute_streak(p_user, (select now_ts from t));
  select * from public.streaks where user_id = p_user;
$$;

create function pg_temp.status(p_user uuid, p_week date) returns text language sql as $$
  select status from public.streak_weeks where user_id = p_user and week_start = p_week;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bo@example.com', '{"full_name": "Bo"}');
update public.profiles set weekly_goal = 1, onboarded_at = now();

-- Both hit 09-07 and 09-14, skip two weeks, then hit 10-05.
select pg_temp.workouts(u, array['2026-09-08', '2026-09-15', '2026-10-06'])
from unnest(array['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b']::uuid[]) u;

-- ─── Without rest the gap breaks the streak ─────────────────────────────────

select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000b')).current_weeks, 1,
  'without rest mode, two missed weeks reset the streak');

-- ─── With rest the gap holds ─────────────────────────────────────────────────

insert into public.rest_periods (user_id, starts_on, ends_on)
values ('00000000-0000-0000-0000-00000000000a', '2026-09-22', '2026-10-01');

select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).current_weeks, 3,
  'rest weeks hold the streak without adding to it');
select is(pg_temp.status('00000000-0000-0000-0000-00000000000a', '2026-09-21'), 'rest',
  'a week overlapping a rest period is marked rest');
select is(pg_temp.status('00000000-0000-0000-0000-00000000000a', '2026-09-28'), 'rest',
  'every week the rest period touches is covered');
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).freezes_banked, 0::smallint,
  'resting does not spend or earn freezes');

-- A workout during rest still counts.
select pg_temp.workouts('00000000-0000-0000-0000-00000000000a', array['2026-09-23']);
select is((pg_temp.recompute('00000000-0000-0000-0000-00000000000a')).current_weeks, 4,
  'hitting the goal during rest still counts as a hit');
select is(pg_temp.status('00000000-0000-0000-0000-00000000000a', '2026-09-21'), 'hit',
  'a hit week is a hit, even while resting');

-- ─── Friend streaks ──────────────────────────────────────────────────────────

-- Bo rests over the same weeks; their friend streak survives the gap.
insert into public.rest_periods (user_id, starts_on, ends_on)
values ('00000000-0000-0000-0000-00000000000b', '2026-09-21', '2026-10-04');
select pg_temp.recompute('00000000-0000-0000-0000-00000000000b');
select is(public.friend_streak('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
  '2026-09-01', (select now_ts from t)), 3, 'rest weeks hold a friend streak too');

-- ─── Open rest period covers the current week ────────────────────────────────

delete from public.rest_periods where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.workouts
where user_id = '00000000-0000-0000-0000-00000000000b' and started_at >= '2026-10-01';
insert into public.rest_periods (user_id, starts_on)
values ('00000000-0000-0000-0000-00000000000b', '2026-09-21');
select pg_temp.recompute('00000000-0000-0000-0000-00000000000b');
select is(pg_temp.status('00000000-0000-0000-0000-00000000000b', '2026-10-05'), 'rest',
  'an open-ended rest period covers the current week');

-- ─── Reminders skip resting people ───────────────────────────────────────────

update public.profiles set resting_since = now() where id = '00000000-0000-0000-0000-00000000000b';
select is(public.send_streak_reminders('2026-10-11 18:00+00'), 0, 'resting people get no streak reminders');

-- ─── set_rest_mode ───────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a"}', true);
set local role authenticated;
select public.set_rest_mode(true);
select public.set_rest_mode(true);
select is((select count(*) from public.rest_periods where ends_on is null), 1::bigint,
  'turning rest mode on twice opens a single period');
select isnt((select resting_since from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), null,
  'the profile shows rest mode is on');
select public.set_rest_mode(false);
select is((select count(*) from public.rest_periods where ends_on is null), 0::bigint,
  'turning rest mode off closes the period (and users only see their own periods)');
reset role;

select * from finish();
rollback;
