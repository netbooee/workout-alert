-- The weekly group podium push. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

-- Sunday 2026-11-08: last week ran Sun 11-01 to Sat 11-07. Los Angeles is UTC-8 then.
create temp table t as select
  '2026-11-08 09:00+00'::timestamptz as sun_9am_utc,
  '2026-11-08 10:00+00'::timestamptz as sun_10am_utc,
  '2026-11-08 17:00+00'::timestamptz as sun_9am_la,
  '2026-11-09 09:00+00'::timestamptz as mon_9am_utc;

create function pg_temp.user(p_id text, p_name text, p_tz text default 'UTC') returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (('00000000-0000-0000-0000-0000000000' || p_id)::uuid, lower(p_name) || '@example.com',
          json_build_object('full_name', p_name));
  update public.profiles set timezone = p_tz, onboarded_at = '2026-10-01'
  where id = ('00000000-0000-0000-0000-0000000000' || p_id)::uuid;
$$;

create function pg_temp.uid(p_id text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000000' || p_id)::uuid;
$$;

create function pg_temp.xp(p_id text, p_amount int, p_at timestamptz) returns void language sql as $$
  insert into public.xp_events (user_id, kind, ref, amount, created_at)
  values (pg_temp.uid(p_id), 'steps', gen_random_uuid()::text, p_amount, p_at);
$$;

create function pg_temp.grp(p_name text, p_emoji text, p_code text, p_ids text[]) returns uuid language plpgsql as $$
declare gid uuid;
begin
  insert into public.groups (name, emoji, invite_code) values (p_name, p_emoji, p_code) returning id into gid;
  insert into public.group_members (group_id, user_id, role, joined_at)
  select gid, pg_temp.uid(u), case when i = 1 then 'owner' else 'member' end, now() + i * interval '1 second'
  from unnest(p_ids) with ordinality as a(u, i);
  return gid;
end;
$$;

create function pg_temp.push(p_id text, p_group uuid) returns public.notifications language sql as $$
  select * from public.notifications
  where user_id = pg_temp.uid(p_id) and kind = 'group' and url = '/group/' || p_group;
$$;

select pg_temp.user('0a', 'Alex Smith');
select pg_temp.user('0b', 'Blair');
select pg_temp.user('0c', 'Casey');
select pg_temp.user('0d', 'Drew');
select pg_temp.user('0e', 'Eli');
select pg_temp.user('0f', 'Fay');
select pg_temp.user('01', 'Gus');
select pg_temp.user('02', 'Hana', 'America/Los_Angeles');
select pg_temp.user('03', 'Ivy');
update public.profiles set notify_groups = false where id = pg_temp.uid('01');

-- Last week: Alex and Blair tie on 300, then Casey 200, Drew 100, Fay 50, Hana 120.
-- Eli, Gus and Ivy earned nothing.
select pg_temp.xp('0a', 200, '2026-11-02 12:00+00'); select pg_temp.xp('0a', 100, '2026-11-06 12:00+00');
select pg_temp.xp('0b', 300, '2026-11-03 12:00+00');
select pg_temp.xp('0c', 200, '2026-11-04 12:00+00');
select pg_temp.xp('0d', 100, '2026-11-01 00:30+00');
select pg_temp.xp('0f', 50, '2026-11-05 12:00+00');
select pg_temp.xp('02', 120, '2026-11-05 12:00+00');
-- Outside last week: the week before, and this morning.
select pg_temp.xp('0d', 500, '2026-10-31 23:30+00');
select pg_temp.xp('0d', 1000, '2026-11-08 08:00+00');

create temp table groups_t as select
  pg_temp.grp('Gym Rats', '🏋️', 'GYMRAT', array['0a', '0b', '0c', '0d', '0e', '0f', '01']) as gym,
  pg_temp.grp('Duo', '🤝', 'DUODUO', array['0a', '02']) as duo,
  pg_temp.grp('Quiet', '🤫', 'QUIETT', array['0e', '03']) as quiet;

-- ─── Sunday 9am UTC ──────────────────────────────────────────────────────────

select is(public.send_group_podiums((select sun_9am_utc from t)), 7,
  '9am Sunday: everyone in UTC gets one per group, except Gus (notifications off)');

select is((select title from pg_temp.push('0a', (select gym from groups_t))), '🥇 You won gold in 🏋️ Gym Rats!',
  'a gold medalist hears it first');
select is((select body from pg_temp.push('0a', (select gym from groups_t))),
  '🥇 You 300 · 🥇 Blair 300 · 🥈 Casey 200 · 🥉 Drew 100 treats',
  'ties share a medal, the next amount takes the next one, and only last week counts');
select is((select body from pg_temp.push('0b', (select gym from groups_t))),
  '🥇 You 300 · 🥇 Alex 300 · 🥈 Casey 200 · 🥉 Drew 100 treats',
  'each person sees themselves as You, first among a tie');
select is((select title from pg_temp.push('0c', (select gym from groups_t))), '🥈 You took silver in 🏋️ Gym Rats!',
  'silver');
select is((select title from pg_temp.push('0d', (select gym from groups_t))), '🥉 You took bronze in 🏋️ Gym Rats!',
  'bronze');
select is((select title from pg_temp.push('0f', (select gym from groups_t))), '🏋️ Gym Rats: the podium is in',
  'off the podium, a neutral title');
select is((select body from pg_temp.push('0f', (select gym from groups_t))),
  E'🥇 Alex 300 · 🥇 Blair 300 · 🥈 Casey 200 · 🥉 Drew 100 treats\nYou were 4th with 50 treats. Fresh week, let''s go 💪',
  'with your own place');
select is((select body from pg_temp.push('0e', (select gym from groups_t))),
  E'🥇 Alex 300 · 🥇 Blair 300 · 🥈 Casey 200 · 🥉 Drew 100 treats\nFresh week, fresh start. Let''s go 💪',
  'no XP, no place named');
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('01')), 0,
  'Gus turned group notifications off');
select is((select count(*)::int from public.notifications where url = '/group/' || (select quiet from groups_t)), 0,
  'a group where nobody earned XP stays quiet');

select is((select title || ' / ' || body from pg_temp.push('0a', (select duo from groups_t))),
  '🥇 You won the week in 🤝 Duo! / 300 to 120 treats against Hana. Fresh week, let''s go 💪',
  'a group of two gets a head-to-head');
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('02')), 0,
  'it''s 1am in Los Angeles, so Hana waits');

-- ─── Once only, and only at 9am Sunday ──────────────────────────────────────

select is(public.send_group_podiums((select sun_9am_utc from t)), 0, 'running twice sends nothing new');
select is(public.send_group_podiums((select sun_10am_utc from t)) + public.send_group_podiums((select mon_9am_utc from t)),
  0, 'nothing at 10am or on Monday');

-- ─── 9am in Los Angeles ─────────────────────────────────────────────────────

select is(public.send_group_podiums((select sun_9am_la from t)), 1, '9am in Los Angeles: Hana''s turn');
select is((select title || ' / ' || body from pg_temp.push('02', (select duo from groups_t))),
  '🤝 Duo: Alex won the week / 300 to 120 treats. Fresh week, let''s go 💪',
  'the runner-up hears who won');

select * from finish();
rollback;
