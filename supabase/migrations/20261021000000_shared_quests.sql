-- Shared quests: an incentive where both partners' workouts count toward one
-- goal, like Duolingo's Friends Quest.
--
--   "8 workout days between us this week → 🍕 Pizza night together"
--
--   * Offered and accepted like any incentive; the window follows the
--     recipient's timezone.
--   * Progress = the recipient's share + the giver's share (stored separately
--     in from_progress so the app can show who did what).
--   * Goals: workout days, active minutes, or workouts. Not streak weeks,
--     which don't add up between two people. Targets can go twice as high.
--   * Earning it gives both people +100 XP; either of them can mark the
--     reward delivered.

alter table public.incentives
  add column shared boolean not null default false,
  add column from_progress integer not null default 0,
  add constraint incentives_shared_goal_check check (not shared or goal_kind <> 'streak_weeks');

-- ─── Text ────────────────────────────────────────────────────────────────────

-- Mirrors incentiveGoalText() in src/lib/incentives.ts.
create or replace function public.incentive_goal_text(i public.incentives)
returns text
language sql
stable
set search_path = ''
as $$
  select case i.goal_kind
    when 'workout_days' then format('Hit %s workout day%s', i.goal_target, case when i.goal_target = 1 then '' else 's' end)
    when 'active_minutes' then format('Hit %s active minutes', i.goal_target)
    when 'workouts' then format('Hit %s %s', i.goal_target,
      coalesce(public.activity_label(i.activity_type), 'workout') || case when i.goal_target = 1 then '' else 's' end)
    else format('Reach a %s-week streak', i.goal_target)
  end
  || case when i.shared then ' between us' else '' end
  || case when i.weeks = 1 then ' this week' else format(' in %s weeks', i.weeks) end;
$$;

-- ─── Progress ────────────────────────────────────────────────────────────────

-- One person's progress toward an incentive's goal within its window.
create function public.incentive_user_progress(i public.incentives, p_user uuid)
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
      where c.duration_s >= p.min_workout_minutes * 60
    )
    when 'active_minutes' then (select coalesce(sum(c.duration_s), 0)::int / 60 from counted c)
    when 'workouts' then (
      select count(*)::int from counted c
      where i.activity_type is null or c.activity_type = i.activity_type
    )
    else (select coalesce(s.current_weeks, 0) from public.streaks s where s.user_id = p_user)
  end;
$$;

revoke execute on function public.incentive_user_progress(public.incentives, uuid) from public, anon, authenticated;

create or replace function public.incentive_progress(i public.incentives)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.incentive_user_progress(i, i.to_id)
    + case when i.shared then public.incentive_user_progress(i, i.from_id) else 0 end;
$$;

-- Re-evaluates the open incentives a person's workouts count toward (ones
-- they received, and shared quests they offered): updates progress, awards
-- the ones that hit their goal, and expires the ones whose window has passed.
create or replace function public.refresh_incentives(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.incentives;
  mine integer;
  theirs integer;
  done integer;
  reward text;
begin
  -- Offers nobody answered before the deadline just lapse.
  update public.incentives set status = 'expired'
  where to_id = p_user and status = 'offered' and ends_at <= now();

  for i in
    select * from public.incentives
    where status = 'active' and (to_id = p_user or (shared and from_id = p_user))
    for update
  loop
    theirs := case when i.shared then public.incentive_user_progress(i, i.from_id) else 0 end;
    mine := public.incentive_user_progress(i, i.to_id);
    done := mine + theirs;
    reward := i.reward_emoji || ' ' || i.reward;

    if done >= i.goal_target then
      update public.incentives
      set status = 'earned', progress = done, from_progress = theirs, earned_at = now()
      where id = i.id;

      insert into public.xp_events (user_id, kind, ref, amount)
      values (i.to_id, 'incentive', i.id::text, 100)
      on conflict (user_id, kind, ref) do nothing;

      if i.shared then
        insert into public.xp_events (user_id, kind, ref, amount)
        values (i.from_id, 'incentive', i.id::text, 100)
        on conflict (user_id, kind, ref) do nothing;

        perform public.notify_incentive(i.to_id,
          'You and ' || public.first_name(i.from_id) || ' finished your shared quest! 🎉', reward || ' · +100 XP', i.id);
        perform public.notify_incentive(i.from_id,
          'You and ' || public.first_name(i.to_id) || ' finished your shared quest! 🎉', reward || ' · +100 XP', i.id);
      else
        perform public.notify_incentive(i.to_id,
          'You earned ' || public.first_name(i.from_id) || '’s incentive! 🎉', reward || ' · +100 XP', i.id);
        perform public.notify_incentive(i.from_id,
          public.first_name(i.to_id) || ' earned your incentive 🎉', 'Time to deliver: ' || reward, i.id);
      end if;
    elsif i.ends_at <= now() then
      update public.incentives set status = 'expired', progress = done, from_progress = theirs where id = i.id;

      if i.shared then
        perform public.notify_incentive(i.to_id,
          format('Your shared quest ended at %s of %s', done, i.goal_target),
          'Every workout still counts 💪 Start another?', i.id);
        perform public.notify_incentive(i.from_id,
          format('Your shared quest ended at %s of %s', done, i.goal_target),
          'Every workout still counts 💪 Start another?', i.id);
      else
        perform public.notify_incentive(i.to_id,
          format('So close: %s of %s', done, i.goal_target),
          public.first_name(i.from_id) || '’s incentive ended. Every workout still counts 💪', i.id);
        perform public.notify_incentive(i.from_id,
          format('%s’s incentive ended at %s of %s', public.first_name(i.to_id), done, i.goal_target),
          'Offer another to keep them going?', i.id);
      end if;
    elsif done <> i.progress or theirs <> i.from_progress then
      update public.incentives set progress = done, from_progress = theirs where id = i.id;
    end if;
  end loop;
end;
$$;

-- ─── Actions ─────────────────────────────────────────────────────────────────

drop function public.offer_incentive(uuid, text, integer, integer, text, text, text, boolean, text);

create function public.offer_incentive(
  p_to            uuid,
  p_goal_kind     text,
  p_goal_target   integer,
  p_weeks         integer,
  p_reward        text,
  p_reward_emoji  text default '🎁',
  p_activity_type text default null,
  p_verified_only boolean default false,
  p_notes         text default null,
  p_shared        boolean default false
)
returns public.incentives
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_shared boolean := coalesce(p_shared, false);
  people integer := case when coalesce(p_shared, false) then 2 else 1 end;
  tz text;
  first_day date;
  i public.incentives;
  max_target integer;
begin
  if not public.is_partner(me, p_to) then
    raise exception 'You can only offer incentives to your partners' using errcode = '42501';
  end if;
  if p_weeks is null or p_weeks not between 1 and 4 then
    raise exception 'Incentives last 1 to 4 weeks' using errcode = '22023';
  end if;
  if v_shared and p_goal_kind = 'streak_weeks' then
    raise exception 'A shared quest counts days, workouts, or minutes' using errcode = '22023';
  end if;
  max_target := case p_goal_kind
    when 'workout_days' then 7 * p_weeks * people
    when 'active_minutes' then 1500 * p_weeks * people
    when 'workouts' then 14 * p_weeks * people
    when 'streak_weeks' then 104
  end;
  if max_target is null then
    raise exception 'Unknown goal' using errcode = '22023';
  end if;
  if p_goal_target is null or p_goal_target not between 1 and max_target then
    raise exception 'Pick a goal between 1 and %', max_target using errcode = '22023';
  end if;
  if exists (
    select 1 from public.incentives
    where from_id = me and to_id = p_to and status in ('offered', 'active')
  ) then
    raise exception 'You already have an incentive going with them' using errcode = 'P0001';
  end if;

  -- Whole weeks in the recipient's timezone, starting this Sunday.
  select timezone into tz from public.profiles where id = p_to;
  first_day := public.week_of((now() at time zone tz)::date);

  insert into public.incentives (
    from_id, to_id, goal_kind, goal_target, activity_type, weeks, starts_at, ends_at,
    reward, reward_emoji, verified_only, notes, shared
  ) values (
    me, p_to, p_goal_kind, p_goal_target,
    case when p_goal_kind = 'workouts' then nullif(p_activity_type, '') end,
    p_weeks,
    first_day::timestamp at time zone tz,
    (first_day + 7 * p_weeks)::timestamp at time zone tz,
    btrim(p_reward), coalesce(nullif(btrim(p_reward_emoji), ''), '🎁'), coalesce(p_verified_only, false),
    nullif(btrim(p_notes), ''), v_shared
  )
  returning * into i;

  perform public.notify_incentive(p_to,
    public.first_name(me) || case when v_shared then ' started a shared quest with you 🤝' else ' offered you an incentive 🎁' end,
    public.incentive_goal_text(i) || ' → ' || i.reward_emoji || ' ' || i.reward
      || coalesce(' · ' || left(i.notes, 80), ''), i.id);
  return i;
end;
$$;

revoke execute on function public.offer_incentive(uuid, text, integer, integer, text, text, text, boolean, text, boolean) from public, anon;
grant execute on function public.offer_incentive(uuid, text, integer, integer, text, text, text, boolean, text, boolean) to authenticated;

-- A shared reward belongs to both people, so either one can mark it delivered.
create or replace function public.mark_incentive_delivered(p_id uuid)
returns public.incentives
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  i public.incentives;
begin
  update public.incentives set status = 'delivered', delivered_at = now()
  where id = p_id and status = 'earned' and (from_id = me or (shared and to_id = me))
  returning * into i;
  if i.id is null then
    raise exception 'Only earned incentives you offered can be marked delivered' using errcode = 'P0002';
  end if;

  perform public.notify_incentive(case when me = i.from_id then i.to_id else i.from_id end,
    public.first_name(me) || case when i.shared then ' marked your shared reward as done 🎁' else ' delivered your reward 🎁' end,
    i.reward_emoji || ' ' || i.reward, i.id);
  return i;
end;
$$;
