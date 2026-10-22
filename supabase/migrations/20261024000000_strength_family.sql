-- A "Strength" incentive counts every strength workout. The offer screen stores
-- Strength as Apple's traditionalStrengthTraining, but Apple Watch logs most
-- strength sessions as functionalStrengthTraining (or coreTraining), so those
-- never counted. Goals now match a family of activity types.

create or replace function public.activity_matches(p_goal text, p_activity text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_goal is null then true
    when p_goal = 'traditionalStrengthTraining'
      then p_activity in ('traditionalStrengthTraining', 'functionalStrengthTraining', 'coreTraining')
    else p_activity = p_goal
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
      where public.activity_matches(i.activity_type, c.activity_type)
    )
    else (select coalesce(s.current_weeks, 0) from public.streaks s where s.user_id = p_user)
  end;
$$;

-- Recount open incentives so workouts already done count now.
do $$
declare
  uid uuid;
begin
  for uid in
    select to_id from public.incentives where status = 'active'
    union
    select from_id from public.incentives where status = 'active' and shared
  loop
    perform public.refresh_incentives(uid);
  end loop;
end;
$$;
