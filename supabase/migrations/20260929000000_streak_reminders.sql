-- "Streak at risk" reminders. An hourly job finds people for whom it's 6pm
-- local time and whose weekly goal needs a workout on (almost) every remaining
-- day, and sends at most one reminder per day.

create extension if not exists pg_cron;

alter table public.profiles
  add column notify_streak_reminders boolean not null default true;

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('nudge', 'partner_workout', 'partner_request', 'partner_accepted', 'verified', 'streak_risk'));

create function public.send_streak_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reminder_hour constant int := 18;

  r         record;
  s         public.streaks;
  local_ts  timestamp;
  days_left int;
  needed    int;
  title     text;
  body      text;
  sent      int := 0;
begin
  for r in
    select p.id, p.timezone
    from public.profiles p
    where p.notify_streak_reminders
      and p.onboarded_at is not null
      and extract(hour from p_now at time zone p.timezone) = reminder_hour
  loop
    -- The stored streak may predate this week's workouts or the week rollover.
    perform public.recompute_streak(r.id, p_now);
    select * into s from public.streaks where user_id = r.id;
    if not found or s.current_weeks = 0 then
      continue;
    end if;

    local_ts  := p_now at time zone r.timezone;
    days_left := 8 - extract(isodow from local_ts)::int;   -- including today
    needed    := s.this_week_goal - s.this_week_days;

    -- Done, comfortably on track, or already out of reach (a freeze covers
    -- it if they have one; nagging wouldn't help).
    if needed <= 0 or needed > days_left or days_left - needed > 1 then
      continue;
    end if;

    if days_left = 1 then
      title := format('Last chance to keep your %s-week streak 🔥', s.current_weeks);
      body  := 'One workout today keeps it alive.';
    elsif needed = days_left then
      title := format('Your %s-week streak is on the line 🔥', s.current_weeks);
      body  := format('You need a workout every day left this week: %s to go.', needed);
    else
      title := format('Your %s-week streak is at risk 🔥', s.current_weeks);
      body  := format('%s more workout %s needed with %s days left this week.',
                      needed, case when needed = 1 then 'day' else 'days' end, days_left);
    end if;
    if s.freezes_banked > 0 then
      body := body || ' (A freeze has your back if needed.)';
    end if;

    insert into public.notifications (user_id, kind, title, body, url, dedupe_key)
    values (r.id, 'streak_risk', title, body, '/', 'streak-risk:' || local_ts::date)
    on conflict do nothing;
    if found then
      sent := sent + 1;
    end if;
  end loop;

  return sent;
end;
$$;

revoke execute on function public.send_streak_reminders(timestamptz) from public, anon, authenticated;

-- Every hour on the hour; each person is only picked up at their local 6pm.
select cron.schedule('streak-reminders', '0 * * * *', $$select public.send_streak_reminders()$$);
