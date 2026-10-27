-- Invite rewards: when someone new joins with your invite and logs their first
-- workout that counts, you both get +100 XP. "New" means the account is under
-- 14 days old when it sends its first partner request with your code or link;
-- the reward waits until the partnership is accepted. An inviter can earn it
-- for up to 10 people.

alter table public.xp_events
  drop constraint xp_events_kind_check,
  add constraint xp_events_kind_check
    check (kind in ('workout', 'evidence', 'week_goal', 'incentive', 'verified', 'verifier', 'steps', 'invite'));

create table public.invites (
  invitee_id  uuid primary key references public.profiles (id) on delete cascade,
  inviter_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  rewarded_at timestamptz
);

create index invites_inviter_idx on public.invites (inviter_id);

alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;
create policy "Read own invites" on public.invites
  for select to authenticated using ((select auth.uid()) in (inviter_id, invitee_id));
grant select on public.invites to authenticated;

-- A new account's first request is an invite from the person it asked.
create function public.partnerships_record_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.invites (invitee_id, inviter_id)
  select new.requester_id, new.addressee_id
  from public.profiles p
  where p.id = new.requester_id and p.created_at > now() - interval '14 days'
  on conflict (invitee_id) do nothing;
  return null;
end;
$$;

create trigger partnerships_record_invite
  after insert on public.partnerships
  for each row execute function public.partnerships_record_invite();

-- Pays the invite once: accepted partnership, a workout that counts, under the cap.
create function public.award_invite_xp(p_invitee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites
  where invitee_id = p_invitee and rewarded_at is null
  for update;
  if not found then
    return;
  end if;
  if not exists (
    select 1 from public.partnerships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(inv.inviter_id, inv.invitee_id)
      and greatest(requester_id, addressee_id) = greatest(inv.inviter_id, inv.invitee_id)
  ) then
    return;
  end if;
  if not exists (select 1 from public.xp_events where user_id = p_invitee and kind = 'workout') then
    return;
  end if;
  if (select count(*) from public.invites where inviter_id = inv.inviter_id and rewarded_at is not null) >= 10 then
    return;
  end if;

  update public.invites set rewarded_at = now() where invitee_id = p_invitee;
  insert into public.xp_events (user_id, kind, ref, amount) values
    (inv.inviter_id, 'invite', 'invited:' || p_invitee, 100),
    (p_invitee, 'invite', 'welcome', 100)
  on conflict (user_id, kind, ref) do nothing;
end;
$$;

revoke execute on function public.award_invite_xp(uuid) from public, anon, authenticated;

create function public.xp_events_award_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'workout' then
    perform public.award_invite_xp(new.user_id);
  end if;
  return null;
end;
$$;

create trigger xp_events_award_invite
  after insert on public.xp_events
  for each row execute function public.xp_events_award_invite();

create function public.partnerships_award_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.award_invite_xp(new.requester_id);
    perform public.award_invite_xp(new.addressee_id);
  end if;
  return null;
end;
$$;

create trigger partnerships_award_invite
  after update of status on public.partnerships
  for each row execute function public.partnerships_award_invite();
