-- Two devices recording the same workout count once. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name": "Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@example.com', '{"full_name": "Ben"}');
insert into public.partnerships (requester_id, addressee_id, status, accepted_at)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted', now());

-- Ana's morning walk, three hours ago, recorded by her Apple Watch (with heart rate)
-- and her Whoop (a couple of minutes shorter, no heart rate), synced together.
create temp table t0 as select date_trunc('minute', now() - interval '3 hours') as ts;
insert into public.workouts (user_id, source, external_id, activity_type, started_at, ended_at, duration_s, avg_hr, source_name)
select '00000000-0000-0000-0000-00000000000a', 'healthkit', x.ext, 'walking', ts + x.s, ts + x.e,
       extract(epoch from x.e - x.s)::int, x.hr, x.src
from t0, (values
  ('watch-walk', interval '0 min', interval '60 min', 112, 'Ana''s Apple Watch'),
  ('whoop-walk', interval '2 min', interval '58 min', null, 'WHOOP')
) as x(ext, s, e, hr, src);

create function pg_temp.w(p_ext text) returns public.workouts language sql as $$
  select * from public.workouts where external_id = p_ext;
$$;

select is((pg_temp.w('whoop-walk')).duplicate_of, (pg_temp.w('watch-walk')).id,
  'the Whoop copy folds into the Apple Watch workout');
select is((pg_temp.w('watch-walk')).duplicate_of, null, 'the copy with heart rate is the one that counts');
select is((select count(*) from public.xp_events where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'workout'),
  1::bigint, 'the walk earns workout XP once');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'partner_workout'),
  1::bigint, 'Ben hears about the walk once');

-- Ben reacts and comments on the walk.
insert into public.reactions (workout_id, user_id, kind)
values ((pg_temp.w('watch-walk')).id, '00000000-0000-0000-0000-00000000000b', 'fire');
insert into public.workout_comments (workout_id, user_id, body)
values ((pg_temp.w('watch-walk')).id, '00000000-0000-0000-0000-00000000000b', 'Nice!');
-- Ana adds a check-in photo to it.
update public.workouts set photo_paths = array['00000000-0000-0000-0000-00000000000a/x/walk.jpg']
where external_id = 'watch-walk';

-- A Fitbit copy arrives later: also with heart rate, and longer, so it becomes the one that counts.
insert into public.workouts (user_id, source, external_id, activity_type, started_at, ended_at, duration_s, avg_hr, source_name)
select '00000000-0000-0000-0000-00000000000a', 'healthkit', 'fitbit-walk', 'walking',
       ts - interval '1 min', ts + interval '61 min', 62 * 60, 110, 'Fitbit'
from t0;

select is((select count(*) from public.workouts where user_id = '00000000-0000-0000-0000-00000000000a' and duplicate_of is null),
  1::bigint, 'three devices, still one walk');
select is((pg_temp.w('watch-walk')).duplicate_of, (pg_temp.w('fitbit-walk')).id,
  'a richer copy takes over');
select is((select workout_id from public.reactions where user_id = '00000000-0000-0000-0000-00000000000b'),
  (pg_temp.w('fitbit-walk')).id, 'reactions move to the copy that counts');
select is((select workout_id from public.workout_comments where body = 'Nice!'),
  (pg_temp.w('fitbit-walk')).id, 'comments move to the copy that counts');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'partner_workout'),
  1::bigint, 'no second notification when a richer copy takes over');
select is((pg_temp.w('fitbit-walk')).photo_paths, array['00000000-0000-0000-0000-00000000000a/x/walk.jpg'],
  'photos move to the copy that counts');
select is((select count(*) from public.xp_events where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'evidence'),
  1::bigint, 'the photo XP stays, now on the copy that counts');

-- A Whoop-only yoga session later in the day is its own workout; so is a stretch
-- session the same Whoop recorded overlapping it.
insert into public.workouts (user_id, source, external_id, activity_type, started_at, ended_at, duration_s, source_name)
select '00000000-0000-0000-0000-00000000000a', 'healthkit', x.ext, x.kind, ts + x.s, ts + x.e,
       extract(epoch from x.e - x.s)::int, x.src
from t0, (values
  ('whoop-yoga', 'yoga', interval '120 min', interval '160 min', 'WHOOP'),
  ('whoop-stretch', 'flexibility', interval '150 min', interval '170 min', 'WHOOP')
) as x(ext, kind, s, e, src);

select is((pg_temp.w('whoop-yoga')).duplicate_of, null, 'a workout only one device recorded still counts');
select is((pg_temp.w('whoop-stretch')).duplicate_of, null, 'overlapping workouts from the same device are not merged');

-- Deleting the walk removes every device's copy of it.
delete from public.workouts where external_id = 'fitbit-walk';
select is((select count(*) from public.workouts where external_id in ('watch-walk', 'whoop-walk')), 0::bigint,
  'deleting a workout deletes the other devices'' copies');

select * from finish();
rollback;
