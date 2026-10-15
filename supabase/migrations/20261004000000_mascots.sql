-- Pick your streak buddy: Lotl the axolotl (default), Capi the capybara, Lento the
-- sloth, or Canela the red panda. Free to change any time; partners see your pick.

alter table public.profiles
  add column mascot text not null default 'lotl'
    check (mascot in ('lotl', 'capybara', 'sloth', 'red_panda'));

-- my_partners gains each partner's character and whether they're resting, so the
-- Partners tab can draw their character in the right mood. Changing a function's
-- result columns needs a drop and re-create.
drop function public.my_partners();

create function public.my_partners()
returns table (
  partnership_id  uuid,
  partner_id      uuid,
  display_name    text,
  avatar_url      text,
  status          text,
  incoming        boolean,
  current_weeks   integer,
  this_week_days  smallint,
  this_week_goal  smallint,
  friend_streak   integer,
  last_nudged_at  timestamptz,
  mascot          text,
  resting         boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  pid uuid;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Bring everyone's streak up to date so a partner who hasn't opened the app
  -- since the week rolled over doesn't show a stale week.
  perform public.recompute_streak(me);
  for pid in
    select case when p.requester_id = me then p.addressee_id else p.requester_id end
    from public.partnerships p
    where p.status = 'accepted' and me in (p.requester_id, p.addressee_id)
  loop
    perform public.recompute_streak(pid);
  end loop;

  return query
  select
    p.id,
    o.id,
    o.display_name,
    o.avatar_url,
    p.status,
    p.status = 'pending' and p.addressee_id = me,
    coalesce(s.current_weeks, 0),
    coalesce(s.this_week_days, 0::smallint),
    coalesce(s.this_week_goal, o.weekly_goal),
    case when p.status = 'accepted'
      then public.friend_streak(me, o.id, p.accepted_at) else 0 end,
    (select max(n.created_at) from public.nudges n where n.from_id = me and n.to_id = o.id),
    o.mascot,
    -- Rest mode is only shared once you're partners.
    p.status = 'accepted' and o.resting_since is not null
  from public.partnerships p
  join public.profiles o
    on o.id = case when p.requester_id = me then p.addressee_id else p.requester_id end
  left join public.streaks s
    on s.user_id = o.id and p.status = 'accepted'
  where me in (p.requester_id, p.addressee_id)
  order by p.status = 'pending' desc, o.display_name;
end;
$$;

revoke execute on function public.my_partners() from public, anon;
grant execute on function public.my_partners() to authenticated;
