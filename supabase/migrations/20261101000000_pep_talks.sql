-- Pep talks: a partner sends you a photo or a short video (up to 30 seconds,
-- taken in the app) with an optional line, to get you moving. You get a push
-- notification and a banner on Home. Only the sender and the recipient can
-- see it.

-- ─── Pep talks ───────────────────────────────────────────────────────────────

create table public.pep_talks (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  media_kind text not null check (media_kind in ('photo', 'video')),
  -- <sender id>/pep-<timestamp>.<jpg|mp4|mov> in the private pep-talks bucket.
  media_path text not null unique,
  message    text check (char_length(message) <= 140),
  created_at timestamptz not null default now(),
  seen_at    timestamptz,
  check (from_id <> to_id)
);

create index pep_talks_to_idx on public.pep_talks (to_id, created_at desc);
create index pep_talks_from_idx on public.pep_talks (from_id, to_id, created_at desc);

alter table public.pep_talks enable row level security;

create policy "Read own pep talks" on public.pep_talks
  for select to authenticated
  using ((select auth.uid()) in (from_id, to_id));

grant select on public.pep_talks to authenticated;

-- Up to 5 a day to each partner, so it stays special.
create function public.send_pep_talk(
  p_partner uuid,
  p_kind text,
  p_path text,
  p_message text default null
)
returns public.pep_talks
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  result public.pep_talks;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.is_partner(me, p_partner) then
    raise exception 'You can only send pep talks to your partners' using errcode = '42501';
  end if;
  if p_kind not in ('photo', 'video')
     or p_path !~ ('^' || me::text || '/pep-[0-9]+\.' || case p_kind when 'photo' then 'jpg' else '(mp4|mov)' end || '$') then
    raise exception 'That file can''t be sent' using errcode = '22023';
  end if;
  if (
    select count(*) from public.pep_talks
    where from_id = me and to_id = p_partner and created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'You''ve sent them 5 pep talks today. Save some for tomorrow!' using errcode = 'P0001';
  end if;

  insert into public.pep_talks (from_id, to_id, media_kind, media_path, message)
  values (me, p_partner, p_kind, p_path, nullif(btrim(p_message), ''))
  returning * into result;
  return result;
end;
$$;

create function public.mark_pep_talks_seen(p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.pep_talks set seen_at = now()
  where id = any (p_ids) and to_id = auth.uid() and seen_at is null;
$$;

revoke execute on function public.send_pep_talk(uuid, text, text, text) from public, anon;
grant execute on function public.send_pep_talk(uuid, text, text, text) to authenticated;
revoke execute on function public.mark_pep_talks_seen(uuid[]) from public, anon;
grant execute on function public.mark_pep_talks_seen(uuid[]) to authenticated;

-- ─── Files ───────────────────────────────────────────────────────────────────

-- Private bucket; files live under <sender id>/. 25 MB fits a 30-second
-- medium-quality video with room to spare.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pep-talks', 'pep-talks', false, 26214400, array['image/jpeg', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- Whether the signed-in user received a pep talk with this file.
create function public.received_pep_talk_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pep_talks where media_path = p_name and to_id = auth.uid()
  );
$$;

revoke execute on function public.received_pep_talk_file(text) from public, anon;
grant execute on function public.received_pep_talk_file(text) to authenticated;

create policy "Upload own pep talk files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pep-talks' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Delete own pep talk files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pep-talks' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "View sent and received pep talk files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pep-talks'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.received_pep_talk_file(name)
    )
  );

-- ─── Notification ────────────────────────────────────────────────────────────

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('nudge', 'partner_workout', 'partner_request', 'partner_accepted', 'verified',
                    'streak_risk', 'comment', 'incentive', 'pep_talk'));

-- Uses the "Nudges from partners" setting: a pep talk is a friendlier nudge.
create function public.notify_pep_talk()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select notify_nudges from public.profiles where id = new.to_id) then
    return null;
  end if;
  insert into public.notifications (user_id, kind, title, body, url)
  values (
    new.to_id,
    'pep_talk',
    public.first_name(new.from_id) || ' sent you a pep talk 📣',
    coalesce(new.message, case new.media_kind when 'video' then 'Tap to watch it.' else 'Tap to see it.' end),
    '/pep-talk/' || new.id
  );
  return null;
end;
$$;

create trigger pep_talks_notify
  after insert on public.pep_talks
  for each row execute function public.notify_pep_talk();
