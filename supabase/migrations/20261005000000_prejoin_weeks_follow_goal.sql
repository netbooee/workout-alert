-- Weeks from before you joined (imported from Apple Health on first sync) now follow
-- your current weekly goal instead of whatever goal you had on day one. New people can
-- pick a realistic goal and have their recent history count; weeks since joining stay
-- locked to the goal they had, so lowering it later still can't rewrite them.
-- Changing the goal already recomputes the streak (profiles_after_streak_settings_update).

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

  cur_week := date_trunc('week', p_now at time zone prof.timezone)::date;
  -- Weeks before you joined come from your Health history; they follow your current
  -- goal, so picking a realistic goal on day one counts your past too.
  joined_week := date_trunc('week', prof.created_at at time zone prof.timezone)::date;

  for rec in
    with active_days as (
      select distinct (w.started_at at time zone prof.timezone)::date as day
      from public.workouts w
      where w.user_id = p_user
        and w.duration_s >= prof.min_workout_minutes * 60
    ),
    per_week as (
      select date_trunc('week', day)::date as week_start, count(*)::smallint as days
      from active_days
      group by 1
    ),
    bounds as (
      select min(week_start) as first_week from per_week
    )
    select gs::date as week_start,
           coalesce(pw.days, 0)::smallint as days,
           sw.goal as saved_goal,
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

    if rec.days >= week_goal then
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

