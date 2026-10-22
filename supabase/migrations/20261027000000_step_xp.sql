-- Daily steps earn bonus XP in three tiers: 5,000 steps +5, 8,000 +10 more,
-- 12,000 +10 more (25 a day at most). Each tier is its own xp_events row
-- (ref 'YYYY-MM-DD:8000'), so crossing one mid-day pops a celebration.
-- Steps are XP only: they never count toward streaks or challenges.
-- Keep the tiers in sync with src/lib/step-xp.ts.

alter table public.xp_events
  drop constraint xp_events_kind_check,
  add constraint xp_events_kind_check
    check (kind in ('workout', 'evidence', 'week_goal', 'incentive', 'verified', 'verifier', 'steps'));

create function public.step_tiers()
returns table (steps integer, amount integer)
language sql
immutable
as $$
  values (5000, 5), (8000, 10), (12000, 10);
$$;

-- Days before this or before the account existed earn nothing, so the first
-- sync's 12 weeks of history don't flood anyone's XP.
create function public.step_xp_start(p_user uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(date '2026-10-22', (p.created_at at time zone p.timezone)::date)
  from public.profiles p where p.id = p_user;
$$;

create function public.sync_step_xp(p_user uuid, p_day date, p_steps integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
begin
  select timezone into tz from public.profiles where id = p_user;
  if tz is null or p_day < public.step_xp_start(p_user) then
    return;
  end if;

  delete from public.xp_events x
  where x.user_id = p_user and x.kind = 'steps' and x.ref like p_day::text || ':%'
    and split_part(x.ref, ':', 2)::int > coalesce(p_steps, 0);

  -- Earned on that day (its last second, or now if it's today) so it lands in the right league week.
  insert into public.xp_events (user_id, kind, ref, amount, created_at)
  select p_user, 'steps', p_day::text || ':' || t.steps, t.amount,
         least(now(), ((p_day + 1)::timestamp at time zone tz) - interval '1 second')
  from public.step_tiers() t
  where t.steps <= coalesce(p_steps, 0)
  on conflict (user_id, kind, ref) do nothing;
end;
$$;

revoke execute on function public.step_xp_start(uuid) from public, anon, authenticated;
revoke execute on function public.sync_step_xp(uuid, date, integer) from public, anon, authenticated;

create function public.daily_activity_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.steps is not distinct from old.steps then
    return null;
  end if;
  perform public.sync_step_xp(new.user_id, new.day, new.steps);
  return null;
end;
$$;

create trigger daily_activity_step_xp
  after insert or update of steps on public.daily_activity
  for each row execute function public.daily_activity_changed();

-- Today's and recent days' steps already synced count now.
select public.sync_step_xp(user_id, day, steps)
from public.daily_activity
where day >= date '2026-10-22';
