-- Incentives: a partner offers a real-world reward for a stretch goal.
--
--   "Hit 5 workout days this week → ☕ Coffee on me"
--
--   * Only partners can offer; one open offer per giver → recipient at a time.
--   * Goals are measured from data: workout days, active minutes, a number of
--     workouts (optionally one activity type), or reaching a streak length.
--   * Windows are whole weeks in the recipient's timezone, starting this
--     Monday: 1–4 weeks. Workouts already done this week count.
--   * Optional "verified only": only Apple Health workouts or ones a partner
--     verified count (hand-logged ones are self-reported).
--   * Lifecycle: offered → active (accepted) → earned → delivered,
--     or declined / cancelled / expired. Earning awards 100 XP.
--   * All writes go through security-definer functions; progress is computed
--     server-side whenever the recipient's workouts or streak change.

alter table public.profiles
  add column notify_incentives boolean not null default true;

create table public.incentives (
  id            uuid primary key default gen_random_uuid(),
  from_id       uuid not null references public.profiles (id) on delete cascade,
  to_id         uuid not null references public.profiles (id) on delete cascade,
  goal_kind     text not null check (goal_kind in ('workout_days', 'active_minutes', 'workouts', 'streak_weeks')),
  goal_target   integer not null check (goal_target > 0),
  activity_type text,
  weeks         smallint not null check (weeks between 1 and 4),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  reward        text not null check (char_length(btrim(reward)) between 1 and 80),
  reward_emoji  text not null default '🎁' check (char_length(reward_emoji) between 1 and 8),
  verified_only boolean not null default false,
  status        text not null default 'offered'
                check (status in ('offered', 'active', 'earned', 'delivered', 'declined', 'cancelled', 'expired')),
  progress      integer not null default 0,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  earned_at     timestamptz,
  delivered_at  timestamptz,
  check (from_id <> to_id),
  check (activity_type is null or goal_kind = 'workouts'),
  check (ends_at > starts_at)
);

-- One open offer per giver → recipient.
create unique index incentives_open_pair_idx on public.incentives (from_id, to_id)
  where status in ('offered', 'active');
create index incentives_to_idx on public.incentives (to_id, status);
create index incentives_from_idx on public.incentives (from_id, status);

alter table public.incentives enable row level security;

create policy "Read incentives you gave or received" on public.incentives
  for select to authenticated using ((select auth.uid()) in (from_id, to_id));

grant select on public.incentives to authenticated;

-- ─── XP and notification kinds ───────────────────────────────────────────────

alter table public.xp_events
  drop constraint xp_events_kind_check,
  add constraint xp_events_kind_check check (kind in ('workout', 'evidence', 'week_goal', 'incentive'));

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('nudge', 'partner_workout', 'partner_request', 'partner_accepted', 'verified',
                    'streak_risk', 'comment', 'incentive'));

-- ─── Text ────────────────────────────────────────────────────────────────────

-- Mirrors incentiveGoalText() in src/lib/incentives.ts.
create function public.incentive_goal_text(i public.incentives)
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
  || case when i.weeks = 1 then ' this week' else format(' in %s weeks', i.weeks) end;
$$;

-- ─── Progress ────────────────────────────────────────────────────────────────

create function public.incentive_progress(i public.incentives)
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

revoke execute on function public.incentive_progress(public.incentives) from public, anon, authenticated;

create function public.notify_incentive(p_user uuid, p_title text, p_body text, p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, url)
  select p_user, 'incentive', p_title, p_body, '/incentive/' || p_id
  from public.profiles where id = p_user and notify_incentives;
$$;

revoke execute on function public.notify_incentive(uuid, text, text, uuid) from public, anon, authenticated;

-- Re-evaluates a recipient's open incentives: updates progress, awards the
-- ones that hit their goal, and expires the ones whose window has passed.
create function public.refresh_incentives(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.incentives;
  done integer;
  reward text;
begin
  -- Offers nobody answered before the deadline just lapse.
  update public.incentives set status = 'expired'
  where to_id = p_user and status = 'offered' and ends_at <= now();

  for i in
    select * from public.incentives where to_id = p_user and status = 'active' for update
  loop
    done := public.incentive_progress(i);
    reward := i.reward_emoji || ' ' || i.reward;

    if done >= i.goal_target then
      update public.incentives
      set status = 'earned', progress = done, earned_at = now()
      where id = i.id;

      insert into public.xp_events (user_id, kind, ref, amount)
      values (i.to_id, 'incentive', i.id::text, 100)
      on conflict (user_id, kind, ref) do nothing;

      perform public.notify_incentive(i.to_id,
        'You earned ' || public.first_name(i.from_id) || '’s incentive! 🎉', reward || ' · +100 XP', i.id);
      perform public.notify_incentive(i.from_id,
        public.first_name(i.to_id) || ' earned your incentive 🎉', 'Time to deliver: ' || reward, i.id);
    elsif i.ends_at <= now() then
      update public.incentives set status = 'expired', progress = done where id = i.id;

      perform public.notify_incentive(i.to_id,
        format('So close: %s of %s', done, i.goal_target),
        public.first_name(i.from_id) || '’s incentive ended. Every workout still counts 💪', i.id);
      perform public.notify_incentive(i.from_id,
        format('%s’s incentive ended at %s of %s', public.first_name(i.to_id), done, i.goal_target),
        'Offer another to keep them going?', i.id);
    elsif done <> i.progress then
      update public.incentives set progress = done where id = i.id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.refresh_incentives(uuid) from public, anon, authenticated;

-- Hourly sweep so incentives expire even when nobody opens the app.
create function public.expire_incentives()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  n integer := 0;
begin
  for uid in
    select distinct to_id from public.incentives
    where status in ('offered', 'active') and ends_at <= now()
  loop
    perform public.refresh_incentives(uid);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.expire_incentives() from public, anon, authenticated;

-- Every workout change recomputes the streak, which writes the streaks row,
-- so this one trigger covers new, edited, and deleted workouts.
create function public.streaks_refresh_incentives()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_incentives(new.user_id);
  return null;
end;
$$;

create trigger streaks_refresh_incentives
  after insert or update on public.streaks
  for each row execute function public.streaks_refresh_incentives();

-- A partner verifying a workout can complete a verified-only incentive.
create function public.reactions_refresh_incentives()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  r := coalesce(new, old);
  if r.kind = 'verified' then
    perform public.refresh_incentives((select user_id from public.workouts where id = r.workout_id));
  end if;
  return null;
end;
$$;

create trigger reactions_refresh_incentives
  after insert or delete on public.reactions
  for each row execute function public.reactions_refresh_incentives();

-- ─── Actions ─────────────────────────────────────────────────────────────────

create function public.offer_incentive(
  p_to            uuid,
  p_goal_kind     text,
  p_goal_target   integer,
  p_weeks         integer,
  p_reward        text,
  p_reward_emoji  text default '🎁',
  p_activity_type text default null,
  p_verified_only boolean default false
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
    reward, reward_emoji, verified_only
  ) values (
    me, p_to, p_goal_kind, p_goal_target,
    case when p_goal_kind = 'workouts' then nullif(p_activity_type, '') end,
    p_weeks, week_start,
    ((date_trunc('week', now() at time zone tz) + make_interval(weeks => p_weeks)) at time zone tz),
    btrim(p_reward), coalesce(nullif(btrim(p_reward_emoji), ''), '🎁'), coalesce(p_verified_only, false)
  )
  returning * into i;

  perform public.notify_incentive(p_to,
    public.first_name(me) || ' offered you an incentive 🎁',
    public.incentive_goal_text(i) || ' → ' || i.reward_emoji || ' ' || i.reward, i.id);
  return i;
end;
$$;

create function public.respond_to_incentive(p_id uuid, p_accept boolean)
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
    raise exception 'This offer is no longer open' using errcode = 'P0002';
  end if;

  if p_accept then
    perform public.notify_incentive(i.from_id,
      public.first_name(i.to_id) || ' accepted your incentive 🎁',
      public.incentive_goal_text(i) || ' → ' || i.reward_emoji || ' ' || i.reward, i.id);
    -- Workouts already done this week count right away.
    perform public.refresh_incentives(i.to_id);
    select * into i from public.incentives where id = p_id;
  end if;
  return i;
end;
$$;

create function public.cancel_incentive(p_id uuid)
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
    raise exception 'Only open incentives you offered can be cancelled' using errcode = 'P0002';
  end if;
  return i;
end;
$$;

create function public.mark_incentive_delivered(p_id uuid)
returns public.incentives
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.incentives;
begin
  update public.incentives set status = 'delivered', delivered_at = now()
  where id = p_id and from_id = auth.uid() and status = 'earned'
  returning * into i;
  if i.id is null then
    raise exception 'Only earned incentives you offered can be marked delivered' using errcode = 'P0002';
  end if;

  perform public.notify_incentive(i.to_id,
    public.first_name(i.from_id) || ' delivered your reward 🎁', i.reward_emoji || ' ' || i.reward, i.id);
  return i;
end;
$$;

grant execute on function public.offer_incentive(uuid, text, integer, integer, text, text, text, boolean) to authenticated;
grant execute on function public.respond_to_incentive(uuid, boolean) to authenticated;
grant execute on function public.cancel_incentive(uuid) to authenticated;
grant execute on function public.mark_incentive_delivered(uuid) to authenticated;

select cron.schedule('incentive-expiry', '7 * * * *', $$select public.expire_incentives()$$);
