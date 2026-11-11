-- "Treats" instead of "XP" in what people read: the app now calls points
-- treats (the points your buddy collects). Only the wording of two pushes
-- changes: the challenge-finished push and the weekly group podium. Tables,
-- columns, functions and amounts keep their xp names and values.
--
-- Copied from their latest definitions (20261025000000_challenge_wording.sql and
-- 20261109000000_group_podiums.sql) with only the text changed.

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
          'You and ' || public.first_name(i.from_id) || ' finished your challenge together! 🎉', reward || ' · +100 treats', i.id);
        perform public.notify_incentive(i.from_id,
          'You and ' || public.first_name(i.to_id) || ' finished your challenge together! 🎉', reward || ' · +100 treats', i.id);
      else
        perform public.notify_incentive(i.to_id,
          'You completed ' || public.first_name(i.from_id) || '’s challenge! 🎉', reward || ' · +100 treats', i.id);
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


create or replace function public.send_group_podiums(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  podium_hour constant int := 9;
  medal       constant text[] := array['🥇', '🥈', '🥉'];
  medal_name  constant text[] := array['gold', 'silver', 'bronze'];

  r        record;
  g        record;
  local_ts timestamp;
  wk       date;           -- the week that just ended (its Sunday)
  lo       timestamptz;
  hi       timestamptz;
  members  int;
  earners  int;
  my_xp    int;
  my_rank  int;
  other    record;
  line     text;
  title    text;
  body     text;
  sent     int := 0;
begin
  create temp table if not exists pg_temp.podium_rows (
    user_id uuid, name text, xp int, rk int
  ) on commit drop;

  for r in
    select p.id, coalesce(p.timezone, 'UTC') as tz
    from public.profiles p
    where p.notify_groups
      and p.onboarded_at is not null
      and extract(isodow from p_now at time zone coalesce(p.timezone, 'UTC')) = 7
      and extract(hour from p_now at time zone coalesce(p.timezone, 'UTC')) = podium_hour
      and exists (select 1 from public.group_members m where m.user_id = p.id)
  loop
    local_ts := p_now at time zone r.tz;
    wk := public.week_of(local_ts::date) - 7;
    lo := wk::timestamp at time zone r.tz;
    hi := (wk + 7)::timestamp at time zone r.tz;

    for g in
      select gr.id, gr.name, gr.emoji
      from public.group_members m
      join public.groups gr on gr.id = m.group_id
      where m.user_id = r.id
      order by m.joined_at
    loop
      -- Everyone's XP last week, with a medal rank among those who earned any.
      truncate pg_temp.podium_rows;

      insert into pg_temp.podium_rows
      select t.user_id, t.name, t.xp,
             case when t.xp > 0 then dense_rank() over (order by t.xp desc)::int end
      from (
        select m.user_id,
               coalesce(nullif(split_part(pr.display_name, ' ', 1), ''), 'Someone') as name,
               coalesce((select sum(x.amount) from public.xp_events x
                         where x.user_id = m.user_id and x.created_at >= lo and x.created_at < hi), 0)::int as xp
        from public.group_members m
        join public.profiles pr on pr.id = m.user_id
        where m.group_id = g.id
      ) t;

      select count(*), count(*) filter (where xp > 0) into members, earners from pg_temp.podium_rows;
      if members < 2 or earners = 0 then
        continue;
      end if;
      select xp, rk into my_xp, my_rank from pg_temp.podium_rows where user_id = r.id;

      if members = 2 then
        select * into other from pg_temp.podium_rows where user_id <> r.id;
        if my_xp = other.xp then
          title := format('%s %s: a tie!', g.emoji, g.name);
          body  := format('You and %s both earned %s treats last week. Fresh week, let''s go 💪', other.name, my_xp);
        elsif my_xp > other.xp then
          title := format('🥇 You won the week in %s %s!', g.emoji, g.name);
          body  := format('%s to %s treats against %s. Fresh week, let''s go 💪', my_xp, other.xp, other.name);
        else
          title := format('%s %s: %s won the week', g.emoji, g.name, other.name);
          body  := format('%s to %s treats. Fresh week, let''s go 💪', other.xp, my_xp);
        end if;
      else
        select string_agg(
                 medal[p.rk] || ' ' || case when p.user_id = r.id then 'You' else p.name end || ' ' || p.xp,
                 ' · ' order by p.rk, (p.user_id = r.id) desc, p.name)
               || ' treats'
        into line
        from pg_temp.podium_rows p
        where p.rk <= 3;

        if my_rank <= 3 then
          title := case when my_rank = 1
                     then format('🥇 You won gold in %s %s!', g.emoji, g.name)
                     else format('%s You took %s in %s %s!', medal[my_rank], medal_name[my_rank], g.emoji, g.name)
                   end;
          body  := line;
        else
          title := format('%s %s: the podium is in', g.emoji, g.name);
          body  := line || E'\n' || case
                     when my_rank is not null then format('You were %sth with %s treats. Fresh week, let''s go 💪', my_rank, my_xp)
                     else 'Fresh week, fresh start. Let''s go 💪'
                   end;
        end if;
      end if;

      insert into public.notifications (user_id, kind, title, body, url, dedupe_key)
      values (r.id, 'group', title, body, '/group/' || g.id, 'group-podium:' || g.id || ':' || wk)
      on conflict do nothing;
      if found then
        sent := sent + 1;
      end if;
    end loop;
  end loop;

  return sent;
end;
$$;

revoke execute on function public.send_group_podiums(timestamptz) from public, anon, authenticated;
