-- The weekly group podium: on Sunday at 9am in each member's own time zone,
-- every group of 2+ sends its members last week's 🥇🥈🥉 by XP.
--
--   * Only people who earned XP get a medal. Ties share one, and the next
--     amount down takes the next medal (300, 300, 200 → 🥇🥇🥈).
--   * Each person gets a push written for them: "🥈 You took silver in …" if
--     they placed, "…: the podium is in" with their own place if they didn't. Only
--     medalists are named, so nobody is called out for coming last.
--   * Groups of 2 get a head-to-head line instead of a podium.
--   * No push for a group where nobody earned XP, or for people who turned off
--     group notifications. No bonus XP: the medals are the prize.
--
-- "Last week" is the recipient's own Sunday-to-Saturday week, as on the group
-- board. Keep the medal rule in sync with podium() in src/lib/groups.ts.

create function public.send_group_podiums(p_now timestamptz default now())
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
          body  := format('You and %s both earned %s XP last week. Fresh week, let''s go 💪', other.name, my_xp);
        elsif my_xp > other.xp then
          title := format('🥇 You won the week in %s %s!', g.emoji, g.name);
          body  := format('%s to %s XP against %s. Fresh week, let''s go 💪', my_xp, other.xp, other.name);
        else
          title := format('%s %s: %s won the week', g.emoji, g.name, other.name);
          body  := format('%s to %s XP. Fresh week, let''s go 💪', other.xp, my_xp);
        end if;
      else
        select string_agg(
                 medal[p.rk] || ' ' || case when p.user_id = r.id then 'You' else p.name end || ' ' || p.xp,
                 ' · ' order by p.rk, (p.user_id = r.id) desc, p.name)
               || ' XP'
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
                     when my_rank is not null then format('You were %sth with %s XP. Fresh week, let''s go 💪', my_rank, my_xp)
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

-- Hourly; each person is only picked up at 9am on Sunday, their time.
select cron.schedule('group-podiums', '3 * * * *', $$select public.send_group_podiums()$$);
