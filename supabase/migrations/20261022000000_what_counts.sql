-- "What counts": each person decides the shortest workout that counts, and
-- can set a separate (usually higher) bar for walks, or leave walks out. Short
-- auto-detected walks from phone apps were adding noise.
--
-- A workout under the bar is still stored, but it doesn't count toward the
-- streak, XP, incentives or quests, doesn't notify partners, and stays out of
-- their feed. workouts.counted holds the answer so every reader (SQL and the
-- app) uses the same rule; it's set on write and refreshed when the rules change.

alter table public.profiles
  add column min_walk_minutes smallint check (min_walk_minutes between 1 and 240),
  add column count_walks boolean not null default true;

comment on column public.profiles.min_walk_minutes is
  'Shortest walk that counts, in minutes; null means the same as min_workout_minutes.';

create function public.workout_counts(p_user uuid, p_activity text, p_duration_s integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_activity = 'walking' and not p.count_walks then false
    when p_activity = 'walking' then p_duration_s >= coalesce(p.min_walk_minutes, p.min_workout_minutes) * 60
    else p_duration_s >= p.min_workout_minutes * 60
  end
  from public.profiles p where p.id = p_user;
$$;

revoke execute on function public.workout_counts(uuid, text, integer) from public, anon, authenticated;

alter table public.workouts add column counted boolean not null default true;

create function public.workouts_set_counted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.counted := coalesce(public.workout_counts(new.user_id, new.activity_type, new.duration_s), true);
  return new;
end;
$$;

create trigger workouts_set_counted
  before insert or update of user_id, activity_type, duration_s on public.workouts
  for each row execute function public.workouts_set_counted();

-- ─── Readers use the flag ───────────────────────────────────────────────────

create or replace function public.recompute_streak_core(p_user uuid, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hits_per_freeze constant int := 4;
  max_freezes     constant int := 2;

  prof         public.profiles%rowtype;
  cur_week     date;
  rec          record;
  week_goal    smallint;
  week_status  text;
  streak       int := 0;
  longest      int := 0;
  freezes      int := 0;
  hits_to_next int := 0;
  first_week   date;
  cur_days     smallint := 0;
  joined_week  date;
begin
  select * into prof from public.profiles where id = p_user;
  if not found then
    return;
  end if;

  cur_week := public.week_of((p_now at time zone prof.timezone)::date);
  -- Weeks before you joined come from your Health history; they follow your current
  -- goal, so picking a realistic goal on day one counts your past too.
  joined_week := public.week_of((prof.created_at at time zone prof.timezone)::date);

  for rec in
    with active_days as (
      select distinct (w.started_at at time zone prof.timezone)::date as day
      from public.workouts w
      where w.user_id = p_user
        and w.counted
    ),
    per_week as (
      select public.week_of(day) as week_start, count(*)::smallint as days
      from active_days
      group by 1
    ),
    bounds as (
      select min(week_start) as first_week from per_week
    )
    select gs::date as week_start,
           coalesce(pw.days, 0)::smallint as days,
           sw.goal as saved_goal,
           lh.goal as legacy_goal,
           exists (
             select 1 from public.rest_periods r
             where r.user_id = p_user
               and r.starts_on <= gs::date + 6
               and coalesce(r.ends_on, 'infinity'::date) >= gs::date
           ) as is_rest
    from bounds
    cross join generate_series(bounds.first_week, cur_week, interval '1 week') as gs
    left join per_week pw on pw.week_start = gs::date
    left join public.streak_weeks sw on sw.user_id = p_user and sw.week_start = gs::date
    left join public.legacy_week_hits lh on lh.user_id = p_user and lh.week_start = gs::date
    order by 1
  loop
    first_week := coalesce(first_week, rec.week_start);

    -- Past weeks since you joined keep the goal that applied at the time, so
    -- lowering your goal can't rewrite them. The current week, and weeks from
    -- before you joined, follow the profile so goal changes take effect.
    week_goal := case
      when rec.week_start = cur_week or rec.week_start < joined_week then prof.weekly_goal
      else coalesce(rec.saved_goal, prof.weekly_goal)
    end;

    if rec.days >= week_goal or rec.legacy_goal >= week_goal then
      week_status  := 'hit';
      streak       := streak + 1;
      hits_to_next := hits_to_next + 1;
      if hits_to_next >= hits_per_freeze then
        hits_to_next := 0;
        freezes := least(freezes + 1, max_freezes);
      end if;
    elsif rec.is_rest then
      -- Rest mode (illness, injury, travel): the week neither adds to nor
      -- breaks the streak, and no freeze is spent.
      week_status := 'rest';
    elsif rec.week_start = cur_week then
      week_status := 'in_progress';
    elsif freezes > 0 and streak > 0 then
      week_status := 'frozen';
      freezes     := freezes - 1;
    else
      week_status  := 'missed';
      streak       := 0;
      hits_to_next := 0;
    end if;

    longest := greatest(longest, streak);

    if rec.week_start = cur_week then
      cur_days := rec.days;
    end if;

    insert into public.streak_weeks (user_id, week_start, active_days, goal, status)
    values (p_user, rec.week_start, rec.days, week_goal, week_status)
    on conflict (user_id, week_start) do update
      set active_days = excluded.active_days,
          goal        = excluded.goal,
          status      = excluded.status;
  end loop;

  -- Drop weeks that no longer fall in range (e.g. the earliest workout was deleted).
  delete from public.streak_weeks
  where user_id = p_user
    and (first_week is null or week_start < first_week or week_start > cur_week);

  insert into public.streaks as s (
    user_id, current_weeks, longest_weeks, freezes_banked,
    this_week_start, this_week_days, this_week_goal, updated_at
  )
  values (
    p_user, streak, longest, freezes,
    cur_week, cur_days, prof.weekly_goal, p_now
  )
  on conflict (user_id) do update
    set current_weeks   = excluded.current_weeks,
        longest_weeks   = excluded.longest_weeks,
        freezes_banked  = excluded.freezes_banked,
        this_week_start = excluded.this_week_start,
        this_week_days  = excluded.this_week_days,
        this_week_goal  = excluded.this_week_goal,
        updated_at      = excluded.updated_at;
end;
$$;

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
  select w.user_id, 'evidence', w.id::text, 5
  from public.workouts w
  where w.user_id = p_user and w.duplicate_of is null and w.counted and cardinality(w.photo_paths) > 0
  on conflict (user_id, kind, ref) do nothing;
$$;

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
  join public.workouts cur on cur.id = w.id and cur.duplicate_of is null and cur.counted
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

create or replace function public.incentive_user_progress(i public.incentives, p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select w.*
    from public.workouts w
    where w.user_id = p_user
      and w.started_at >= i.starts_at
      and w.started_at < i.ends_at
      and w.duplicate_of is null
      and w.counted
      and (
        not i.verified_only
        or w.source = 'healthkit'
        or exists (select 1 from public.reactions r where r.workout_id = w.id and r.kind = 'verified')
      )
  )
  select case i.goal_kind
    when 'workout_days' then (
      select count(distinct (c.started_at at time zone p.timezone)::date)::int
      from counted c join public.profiles p on p.id = p_user
    )
    when 'active_minutes' then (select coalesce(sum(c.duration_s), 0)::int / 60 from counted c)
    when 'workouts' then (
      select count(*)::int from counted c
      where i.activity_type is null or c.activity_type = i.activity_type
    )
    else (select coalesce(s.current_weeks, 0) from public.streaks s where s.user_id = p_user)
  end;
$$;

-- ─── Changing the rules ─────────────────────────────────────────────────────

-- Re-marks the person's workouts, then settles XP and the streak (which also
-- refreshes incentives). The workout triggers skip nested updates, so this
-- calls them directly.
create function public.apply_workout_count_rules(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workouts w
  set counted = public.workout_counts(w.user_id, w.activity_type, w.duration_s)
  where w.user_id = p_user
    and w.counted is distinct from public.workout_counts(w.user_id, w.activity_type, w.duration_s);
  perform public.sync_workout_xp(p_user);
  perform public.recompute_streak(p_user);
end;
$$;

revoke execute on function public.apply_workout_count_rules(uuid) from public, anon, authenticated;

create function public.profile_count_rules_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_workout_count_rules(new.id);
  return null;
end;
$$;

create trigger profiles_after_count_rules_update
  after update of min_workout_minutes, min_walk_minutes, count_walks on public.profiles
  for each row
  when (old.min_workout_minutes is distinct from new.min_workout_minutes
     or old.min_walk_minutes is distinct from new.min_walk_minutes
     or old.count_walks is distinct from new.count_walks)
  execute function public.profile_count_rules_changed();

-- Mark what's already stored (default rules: 15 minutes for everything).
do $$
declare
  uid uuid;
begin
  for uid in select id from public.profiles loop
    perform public.apply_workout_count_rules(uid);
  end loop;
end;
$$;
