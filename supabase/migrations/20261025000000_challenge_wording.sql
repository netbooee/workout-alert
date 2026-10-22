-- "Challenge" everywhere: incentives and shared quests are one idea in the app
-- now (a challenge you reward, or one you do together), so the pushes and error
-- messages say "challenge" too. Only wording changes; tables and functions keep
-- their names.

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
          'You and ' || public.first_name(i.from_id) || ' finished your challenge together! 🎉', reward || ' · +100 XP', i.id);
        perform public.notify_incentive(i.from_id,
          'You and ' || public.first_name(i.to_id) || ' finished your challenge together! 🎉', reward || ' · +100 XP', i.id);
      else
        perform public.notify_incentive(i.to_id,
          'You completed ' || public.first_name(i.from_id) || '’s challenge! 🎉', reward || ' · +100 XP', i.id);
        perform public.notify_incentive(i.from_id,
          public.first_name(i.to_id) || ' completed your challenge 🎉', 'Time to deliver: ' || reward, i.id);
      end if;
    elsif i.ends_at <= now() then
      update public.incentives set status = 'expired', progress = done, from_progress = theirs where id = i.id;

      if i.shared then
        perform public.notify_incentive(i.to_id,
          format('Your challenge together ended at %s of %s', done, i.goal_target),
          'Every workout still counts 💪 Start another?', i.id);
        perform public.notify_incentive(i.from_id,
          format('Your challenge together ended at %s of %s', done, i.goal_target),
          'Every workout still counts 💪 Start another?', i.id);
      else
        perform public.notify_incentive(i.to_id,
          format('So close: %s of %s', done, i.goal_target),
          public.first_name(i.from_id) || '’s challenge ended. Every workout still counts 💪', i.id);
        perform public.notify_incentive(i.from_id,
          format('%s’s challenge ended at %s of %s', public.first_name(i.to_id), done, i.goal_target),
          'Challenge them again to keep them going?', i.id);
      end if;
    elsif done <> i.progress or theirs <> i.from_progress then
      update public.incentives set progress = done, from_progress = theirs where id = i.id;
    end if;
  end loop;
end;
$$;

create or replace function public.offer_incentive(
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
    raise exception 'You can only challenge your partners' using errcode = '42501';
  end if;
  if p_weeks is null or p_weeks not between 1 and 4 then
    raise exception 'Incentives last 1 to 4 weeks' using errcode = '22023';
  end if;
  if v_shared and p_goal_kind = 'streak_weeks' then
    raise exception 'A challenge together counts days, workouts, or minutes' using errcode = '22023';
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
    raise exception 'You already have a challenge going with them' using errcode = 'P0001';
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
    public.first_name(me) || case when v_shared then ' wants to take on a challenge with you 🤝' else ' challenged you 🎯' end,
    public.incentive_goal_text(i) || ' → ' || i.reward_emoji || ' ' || i.reward
      || coalesce(' · ' || left(i.notes, 80), ''), i.id);
  return i;
end;
$$;

create or replace function public.respond_to_incentive(p_id uuid, p_accept boolean)
returns public.incentives
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.incentives;
begin
  update public.incentives
  set status = case when p_accept then 'active' else 'declined' end, responded_at = now()
  where id = p_id and to_id = auth.uid() and status = 'offered' and ends_at > now()
  returning * into i;
  if i.id is null then
    raise exception 'This challenge is no longer open' using errcode = 'P0002';
  end if;

  if p_accept then
    perform public.notify_incentive(i.from_id,
      public.first_name(i.to_id) || ' accepted your challenge 🎯',
      public.incentive_goal_text(i) || ' → ' || i.reward_emoji || ' ' || i.reward, i.id);
    -- Workouts already done this week count right away.
    perform public.refresh_incentives(i.to_id);
    select * into i from public.incentives where id = p_id;
  end if;
  return i;
end;
$$;

create or replace function public.cancel_incentive(p_id uuid)
returns public.incentives
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.incentives;
begin
  update public.incentives set status = 'cancelled'
  where id = p_id and from_id = auth.uid() and status in ('offered', 'active')
  returning * into i;
  if i.id is null then
    raise exception 'Only open challenges you started can be cancelled' using errcode = 'P0002';
  end if;
  return i;
end;
$$;

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
    raise exception 'Only completed challenges you started can be marked delivered' using errcode = 'P0002';
  end if;

  perform public.notify_incentive(case when me = i.from_id then i.to_id else i.from_id end,
    public.first_name(me) || case when i.shared then ' marked your reward as done 🎁' else ' delivered your reward 🎁' end,
    i.reward_emoji || ' ' || i.reward, i.id);
  return i;
end;
$$;
