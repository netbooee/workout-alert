-- Verifying a partner's workout is worth XP on both sides: +5 to the owner the first
-- time any partner verifies it, and +2 to the partner who verified, for up to three
-- verifications a day (in their timezone) so it can't be farmed. Removing the ✅
-- takes it back.

alter table public.xp_events
  drop constraint xp_events_kind_check,
  add constraint xp_events_kind_check
    check (kind in ('workout', 'evidence', 'week_goal', 'incentive', 'verified', 'verifier'));

-- How many verifications have earned someone XP today, in their timezone.
create function public.verifier_xp_today(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.xp_events x
  join public.profiles p on p.id = x.user_id
  where x.user_id = p_user
    and x.kind = 'verifier'
    and (x.created_at at time zone p.timezone)::date = (now() at time zone p.timezone)::date;
$$;

revoke execute on function public.verifier_xp_today(uuid) from public, anon, authenticated;

create function public.verification_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if tg_op = 'INSERT' then
    if new.kind <> 'verified' then
      return null;
    end if;
    select user_id into owner from public.workouts where id = new.workout_id;
    if owner is null or owner = new.user_id then
      return null;
    end if;

    insert into public.xp_events (user_id, kind, ref, amount)
    values (owner, 'verified', new.workout_id::text, 5)
    on conflict (user_id, kind, ref) do nothing;

    if public.verifier_xp_today(new.user_id) < 3 then
      insert into public.xp_events (user_id, kind, ref, amount)
      values (new.user_id, 'verifier', new.workout_id::text, 2)
      on conflict (user_id, kind, ref) do nothing;
    end if;
  else
    if old.kind <> 'verified' then
      return null;
    end if;
    delete from public.xp_events
    where user_id = old.user_id and kind = 'verifier' and ref = old.workout_id::text;
    -- The owner keeps their +5 while any partner's ✅ remains.
    delete from public.xp_events x
    where x.kind = 'verified' and x.ref = old.workout_id::text
      and not exists (
        select 1 from public.reactions r where r.workout_id = old.workout_id and r.kind = 'verified'
      );
  end if;
  return null;
end;
$$;

create trigger reactions_verification_xp
  after insert or delete on public.reactions
  for each row execute function public.verification_xp();

-- Verifications made before this existed earn the same XP, dated when they happened
-- (so they land in the right league week) and already "seen" so they don't pop a
-- celebration.
insert into public.xp_events (user_id, kind, ref, amount, created_at, awarded_at)
select distinct on (w.user_id, w.id) w.user_id, 'verified', w.id::text, 5, r.created_at, r.created_at
from public.reactions r
join public.workouts w on w.id = r.workout_id
where r.kind = 'verified' and r.user_id <> w.user_id
order by w.user_id, w.id, r.created_at
on conflict (user_id, kind, ref) do nothing;

insert into public.xp_events (user_id, kind, ref, amount, created_at, awarded_at)
select user_id, 'verifier', workout_id::text, 2, created_at, created_at
from (
  select r.user_id, r.workout_id, r.created_at,
         row_number() over (
           partition by r.user_id, (r.created_at at time zone p.timezone)::date
           order by r.created_at
         ) as nth
  from public.reactions r
  join public.workouts w on w.id = r.workout_id
  join public.profiles p on p.id = r.user_id
  where r.kind = 'verified' and r.user_id <> w.user_id
) v
where nth <= 3
on conflict (user_id, kind, ref) do nothing;
