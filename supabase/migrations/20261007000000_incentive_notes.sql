-- Incentives get optional "rules and notes" from the partner offering them (what
-- counts, where the reward happens, ...), shown to the recipient with the offer.

alter table public.incentives
  add column notes text check (char_length(notes) <= 500);

-- Same function plus p_notes (defaulted, so older app builds keep working).
drop function public.offer_incentive(uuid, text, integer, integer, text, text, text, boolean);

create function public.offer_incentive(
  p_to            uuid,
  p_goal_kind     text,
  p_goal_target   integer,
  p_weeks         integer,
  p_reward        text,
  p_reward_emoji  text default '🎁',
  p_activity_type text default null,
  p_verified_only boolean default false,
  p_notes         text default null
)
returns public.incentives
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  tz text;
  week_start timestamptz;
  i public.incentives;
  max_target integer;
begin
  if not public.is_partner(me, p_to) then
    raise exception 'You can only offer incentives to your partners' using errcode = '42501';
  end if;
  if p_weeks is null or p_weeks not between 1 and 4 then
    raise exception 'Incentives last 1 to 4 weeks' using errcode = '22023';
  end if;
  max_target := case p_goal_kind
    when 'workout_days' then 7 * p_weeks
    when 'active_minutes' then 1500 * p_weeks
    when 'workouts' then 14 * p_weeks
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

  -- Whole weeks in the recipient's timezone, starting this Monday.
  select timezone into tz from public.profiles where id = p_to;
  week_start := (date_trunc('week', now() at time zone tz)) at time zone tz;

  insert into public.incentives (
    from_id, to_id, goal_kind, goal_target, activity_type, weeks, starts_at, ends_at,
    reward, reward_emoji, verified_only, notes
  ) values (
    me, p_to, p_goal_kind, p_goal_target,
    case when p_goal_kind = 'workouts' then nullif(p_activity_type, '') end,
    p_weeks, week_start,
    ((date_trunc('week', now() at time zone tz) + make_interval(weeks => p_weeks)) at time zone tz),
    btrim(p_reward), coalesce(nullif(btrim(p_reward_emoji), ''), '🎁'), coalesce(p_verified_only, false),
    nullif(btrim(p_notes), '')
  )
  returning * into i;

  perform public.notify_incentive(p_to,
    public.first_name(me) || ' offered you an incentive 🎁',
    public.incentive_goal_text(i) || ' → ' || i.reward_emoji || ' ' || i.reward
      || coalesce(' · ' || left(i.notes, 80), ''), i.id);
  return i;
end;
$$;

revoke execute on function public.offer_incentive(uuid, text, integer, integer, text, text, text, boolean, text) from public, anon;
grant execute on function public.offer_incentive(uuid, text, integer, integer, text, text, text, boolean, text) to authenticated;
