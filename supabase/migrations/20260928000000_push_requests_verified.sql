-- More pushes: partner requests (and acceptances) and verified workouts.
-- Delivery reuses the notifications table + deliver_notification trigger.

alter table public.profiles
  add column notify_partner_requests boolean not null default true,
  add column notify_verifications    boolean not null default true;

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('nudge', 'partner_workout', 'partner_request', 'partner_accepted', 'verified')),
  -- Keeps repeat events (e.g. un-verifying and re-verifying) from pushing twice.
  add column dedupe_key text;

create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

-- ─── Partner requests ────────────────────────────────────────────────────────

create function public.notify_partnership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, kind, title, body, url, dedupe_key)
    select new.addressee_id, 'partner_request',
           public.first_name(new.requester_id) || ' wants to be your accountability partner 🤝',
           'Tap to accept and start keeping each other on track.',
           '/partners',
           'request:' || new.id
    from public.profiles p
    where p.id = new.addressee_id and p.notify_partner_requests
    on conflict do nothing;

  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, kind, title, body, url, dedupe_key)
    select new.requester_id, 'partner_accepted',
           public.first_name(new.addressee_id) || ' accepted your partner request 🤝',
           'You can now see each other''s workouts and streaks.',
           '/partners',
           'accepted:' || new.id
    from public.profiles p
    where p.id = new.requester_id and p.notify_partner_requests
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger partnerships_notify
  after insert or update of status on public.partnerships
  for each row execute function public.notify_partnership();

-- ─── Verified workouts ───────────────────────────────────────────────────────

create function public.notify_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind <> 'verified' then
    return null;
  end if;

  insert into public.notifications (user_id, kind, title, body, url, dedupe_key)
  select w.user_id, 'verified',
         public.first_name(new.user_id) || ' verified your ' || public.activity_label(w.activity_type) || ' ✅',
         format('Your %s-min %s is verified. Nice work!', w.duration_s / 60, public.activity_label(w.activity_type)),
         '/workout/' || w.id,
         'verified:' || w.id || ':' || new.user_id
  from public.workouts w
  join public.profiles owner on owner.id = w.user_id
  where w.id = new.workout_id
    and w.user_id <> new.user_id
    and owner.notify_verifications
  on conflict do nothing;
  return null;
end;
$$;

create trigger reactions_notify_verified
  after insert on public.reactions
  for each row execute function public.notify_verified();
