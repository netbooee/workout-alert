-- Wearing two trackers (say an Apple Watch and a Whoop) records most workouts twice in
-- Apple Health. Keep every device, but treat overlapping workouts from different devices
-- as one: the richest copy (has heart rate, then longest, then oldest) stays, the others
-- point at it through duplicate_of and stop counting for XP, incentives, and the feed.
-- Reactions, comments, and photos on a hidden copy move to the one that stays.

alter table public.workouts add column duplicate_of uuid;
create index workouts_duplicate_of_idx on public.workouts (duplicate_of) where duplicate_of is not null;

comment on column public.workouts.duplicate_of is
  'Set when another device recorded the same workout; points at the copy that counts.';

-- Re-derives duplicate_of for one person's Health workouts, richest first: each workout
-- either stays (no kept workout from a different device overlaps at least half of the
-- shorter one) or folds into the kept workout it overlaps. Then moves reactions,
-- comments, and photos off folded copies. Idempotent; only touches rows that change.
create function public.dedupe_workouts(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w      record;
  winner uuid;
  kept   uuid[] := '{}';
begin
  for w in
    select id, started_at, ended_at, coalesce(source_name, '') as src, duplicate_of
    from public.workouts
    where user_id = p_user and source = 'healthkit'
    order by (avg_hr is not null) desc, duration_s desc, created_at, id
  loop
    select k.id into winner
    from public.workouts k
    where k.id = any (kept)
      and coalesce(k.source_name, '') <> w.src
      and extract(epoch from least(k.ended_at, w.ended_at) - greatest(k.started_at, w.started_at))
          >= 0.5 * greatest(1, least(extract(epoch from k.ended_at - k.started_at),
                                     extract(epoch from w.ended_at - w.started_at)))
    order by array_position(kept, k.id)
    limit 1;

    if winner is null then
      kept := kept || w.id;
    end if;
    if w.duplicate_of is distinct from winner then
      update public.workouts set duplicate_of = winner where id = w.id;
    end if;
  end loop;

  -- Reactions: move to the copy that counts unless the same person already left the
  -- same reaction there (an UPDATE, so "verified" pushes don't fire again).
  update public.reactions r
  set workout_id = d.duplicate_of
  from public.workouts d
  where r.workout_id = d.id
    and d.user_id = p_user
    and d.duplicate_of is not null
    and not exists (
      select 1 from public.reactions x
      where x.workout_id = d.duplicate_of and x.user_id = r.user_id and x.kind = r.kind
    );
  delete from public.reactions r
  using public.workouts d
  where r.workout_id = d.id and d.user_id = p_user and d.duplicate_of is not null;

  update public.workout_comments c
  set workout_id = d.duplicate_of
  from public.workouts d
  where c.workout_id = d.id and d.user_id = p_user and d.duplicate_of is not null;

  -- Photos: the copy that counts gets them all.
  update public.workouts k
  set photo_paths = (
    select array_agg(distinct p order by p)
    from unnest(k.photo_paths || coalesce((
      select array_agg(p2) from public.workouts d, unnest(d.photo_paths) p2
      where d.duplicate_of = k.id
    ), '{}')) p
  )
  where k.user_id = p_user
    and exists (select 1 from public.workouts d where d.duplicate_of = k.id and cardinality(d.photo_paths) > 0);
  update public.workouts
  set photo_paths = '{}'
  where user_id = p_user and duplicate_of is not null and cardinality(photo_paths) > 0;
end;
$$;

revoke execute on function public.dedupe_workouts(uuid) from public, anon, authenticated;

-- Brings one person's workout and evidence XP in line with their workouts: copies
-- hidden as duplicates earn nothing.
create function public.sync_workout_xp(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.xp_events x
  where x.user_id = p_user
    and x.kind in ('workout', 'evidence')
    and not exists (
      select 1 from public.workouts w where w.id::text = x.ref and w.duplicate_of is null
    );

  insert into public.xp_events (user_id, kind, ref, amount, created_at)
  select w.user_id, 'workout', w.id::text, public.workout_xp(w.duration_s), w.ended_at
  from public.workouts w
  where w.user_id = p_user and w.duplicate_of is null and public.workout_xp(w.duration_s) > 0
  on conflict (user_id, kind, ref) do update set amount = excluded.amount;

  insert into public.xp_events (user_id, kind, ref, amount)
  select w.user_id, 'evidence', w.id::text, 5
  from public.workouts w
  where w.user_id = p_user and w.duplicate_of is null and cardinality(w.photo_paths) > 0
  on conflict (user_id, kind, ref) do nothing;
$$;

revoke execute on function public.sync_workout_xp(uuid) from public, anon, authenticated;

-- One handler for inserts, updates, and deletes: fold duplicates, settle XP, recompute
-- the streak. Updates it makes to workouts itself (depth > 1) are skipped.
create or replace function public.workouts_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op = 'DELETE' then
    -- Deleting a workout deletes the other devices' copies of it too.
    delete from public.workouts d using old_rows o where d.duplicate_of = o.id;
    for uid in select distinct user_id from old_rows loop
      perform public.dedupe_workouts(uid);
      perform public.sync_workout_xp(uid);
      perform public.recompute_streak(uid);
    end loop;
  else
    for uid in select distinct user_id from new_rows loop
      perform public.dedupe_workouts(uid);
      perform public.sync_workout_xp(uid);
      perform public.recompute_streak(uid);
    end loop;
  end if;
  return null;
end;
$$;

-- Partners hear about a workout once: not for a copy from a second device, and not
-- when a richer copy replaces one they were already told about.
create or replace function public.notify_partner_workouts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, url)
  select
    partner.id,
    'partner_workout',
    public.first_name(w.user_id) || ' just worked out 🔥',
    format('%s-min %s. Tap to cheer or verify ✅', w.duration_s / 60, public.activity_label(w.activity_type)),
    '/workout/' || w.id
  from new_rows w
  join public.workouts cur on cur.id = w.id and cur.duplicate_of is null
  join public.partnerships p
    on p.status = 'accepted' and w.user_id in (p.requester_id, p.addressee_id)
  join public.profiles partner
    on partner.id = case when p.requester_id = w.user_id then p.addressee_id else p.requester_id end
  where w.ended_at > now() - interval '24 hours'
    and w.duration_s >= 300
    and partner.notify_partner_workouts
    and not exists (
      select 1 from public.workouts older
      where older.duplicate_of = w.id and older.id not in (select id from new_rows)
    );
  return null;
end;
$$;

create or replace function public.incentive_progress(i public.incentives)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select w.*
    from public.workouts w
    where w.user_id = i.to_id
      and w.started_at >= i.starts_at
      and w.started_at < i.ends_at
      and w.duplicate_of is null
      and (
        not i.verified_only
        or w.source = 'healthkit'
        or exists (select 1 from public.reactions r where r.workout_id = w.id and r.kind = 'verified')
      )
  )
  select case i.goal_kind
    when 'workout_days' then (
      select count(distinct (c.started_at at time zone p.timezone)::date)::int
      from counted c join public.profiles p on p.id = i.to_id
      where c.duration_s >= p.min_workout_minutes * 60
    )
    when 'active_minutes' then (select coalesce(sum(c.duration_s), 0)::int / 60 from counted c)
    when 'workouts' then (
      select count(*)::int from counted c
      where i.activity_type is null or c.activity_type = i.activity_type
    )
    else (select coalesce(s.current_weeks, 0) from public.streaks s where s.user_id = i.to_id)
  end;
$$;


-- Clean up duplicates already recorded.
do $$
declare
  uid uuid;
begin
  for uid in select distinct user_id from public.workouts loop
    perform public.dedupe_workouts(uid);
    perform public.sync_workout_xp(uid);
    perform public.recompute_streak(uid);
  end loop;
end;
$$;
