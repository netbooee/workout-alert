-- Push notifications for nudges and partner workouts.
--
-- Triggers write a row to `notifications` (which doubles as an in-app history)
-- and a trigger on that table sends it to every device the recipient has
-- registered, via Expo's push service using pg_net. Delivery is fire-and-forget.

create extension if not exists pg_net with schema extensions;

-- ─── Preferences ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column notify_nudges          boolean not null default true,
  add column notify_partner_workouts boolean not null default true;

-- ─── Device tokens ───────────────────────────────────────────────────────────

create table public.push_tokens (
  token      text primary key,   -- ExponentPushToken[...]
  user_id    uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- A device belongs to whoever signed in on it most recently.
create function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Not an Expo push token' using errcode = '22023';
  end if;
  insert into public.push_tokens (token, user_id)
  values (p_token, auth.uid())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ─── Notifications ───────────────────────────────────────────────────────────

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('nudge', 'partner_workout')),
  title      text not null,
  body       text not null,
  url        text,               -- in-app route to open when tapped
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create function public.first_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(split_part(display_name, ' ', 1), ''), 'Your partner')
  from public.profiles where id = p_user;
$$;

create function public.activity_label(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'running' then 'run'
    when 'walking' then 'walk'
    when 'hiking' then 'hike'
    when 'cycling' then 'ride'
    when 'swimming' then 'swim'
    when 'yoga' then 'yoga session'
    when 'traditionalStrengthTraining' then 'strength workout'
    when 'functionalStrengthTraining' then 'strength workout'
    when 'highIntensityIntervalTraining' then 'HIIT workout'
    else 'workout'
  end;
$$;

-- Nudge → the person nudged, with their progress this week.
create function public.notify_nudge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  days smallint;
  goal smallint;
begin
  if not (select notify_nudges from public.profiles where id = new.to_id) then
    return null;
  end if;

  select s.this_week_days, s.this_week_goal into days, goal
  from public.streaks s where s.user_id = new.to_id;

  insert into public.notifications (user_id, kind, title, body, url)
  values (
    new.to_id,
    'nudge',
    public.first_name(new.from_id) || ' nudged you 👋',
    case
      when goal is null then 'Your partners are counting on you. Time to move!'
      else format('You''re at %s of %s days this week. Time to move!', days, goal)
    end,
    '/'
  );
  return null;
end;
$$;

create trigger nudges_notify
  after insert on public.nudges
  for each row execute function public.notify_nudge();

-- New workout → each accepted partner. Only workouts that finished in the last
-- day, so the initial 12-week HealthKit backfill doesn't flood anyone.
create function public.notify_partner_workouts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, url)
  select
    partner.id,
    'partner_workout',
    public.first_name(w.user_id) || ' just worked out 🔥',
    format('%s-min %s. Tap to cheer or verify ✅', w.duration_s / 60, public.activity_label(w.activity_type)),
    '/workout/' || w.id
  from new_rows w
  join public.partnerships p
    on p.status = 'accepted' and w.user_id in (p.requester_id, p.addressee_id)
  join public.profiles partner
    on partner.id = case when p.requester_id = w.user_id then p.addressee_id else p.requester_id end
  where w.ended_at > now() - interval '24 hours'
    and w.duration_s >= 300
    and partner.notify_partner_workouts;
  return null;
end;
$$;

create trigger workouts_notify_partners
  after insert on public.workouts
  referencing new table as new_rows
  for each statement execute function public.notify_partner_workouts();

-- Send each notification to the recipient's devices through Expo's push API.
create function public.deliver_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', new.title,
    'body', new.body,
    'sound', 'default',
    'data', jsonb_build_object('url', new.url, 'kind', new.kind)
  ))
  into messages
  from public.push_tokens t
  where t.user_id = new.user_id;

  if messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return null;
end;
$$;

create trigger notifications_deliver
  after insert on public.notifications
  for each row execute function public.deliver_notification();

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.push_tokens   enable row level security;
alter table public.notifications enable row level security;

-- Tokens are only managed through the functions above.
create policy "Read own push tokens" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.push_tokens to authenticated;
grant select on public.notifications to authenticated;
