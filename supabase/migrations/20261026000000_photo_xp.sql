-- A check-in photo is worth 25 XP (was 5), to encourage sharing photos with
-- partners. Still one bonus per workout, however many photos it has. Workouts
-- that already have a photo are raised to 25 too.

create or replace function public.sync_workout_xp(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.xp_events x
  where x.user_id = p_user
    and x.kind in ('workout', 'evidence')
    and not exists (
      select 1 from public.workouts w where w.id::text = x.ref and w.duplicate_of is null and w.counted
    );

  insert into public.xp_events (user_id, kind, ref, amount, created_at)
  select w.user_id, 'workout', w.id::text, public.workout_xp(w.duration_s), w.ended_at
  from public.workouts w
  where w.user_id = p_user and w.duplicate_of is null and w.counted and public.workout_xp(w.duration_s) > 0
  on conflict (user_id, kind, ref) do update set amount = excluded.amount;

  insert into public.xp_events (user_id, kind, ref, amount)
  select w.user_id, 'evidence', w.id::text, 25
  from public.workouts w
  where w.user_id = p_user and w.duplicate_of is null and w.counted and cardinality(w.photo_paths) > 0
  on conflict (user_id, kind, ref) do update set amount = excluded.amount;
$$;

update public.xp_events set amount = 25 where kind = 'evidence' and amount <> 25;
