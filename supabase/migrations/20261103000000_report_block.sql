-- Report and block (App Store Guideline 1.2, apps with user content).
--
-- Report: anyone can report a person, a comment, a pep talk or a workout
-- (its photos and notes). Reports keep a copy of what was reported, in case
-- it's deleted later, and wait in content_reports for the developer to review
-- (see docs/app-store-launch.md).
--
-- Block: ends any partnership or pending request between the two people and
-- stops new partner requests, nudges and pep talks between them, in both
-- directions. Unblocking doesn't restore the partnership.

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_id uuid references public.profiles (id) on delete set null,
  kind        text not null check (kind in ('user', 'comment', 'pep_talk', 'workout')),
  ref_id      uuid,
  reason      text not null check (reason in ('spam', 'inappropriate', 'harassment', 'other')),
  -- What it said or showed when reported.
  snapshot    text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index content_reports_open_idx on public.content_reports (created_at) where reviewed_at is null;

alter table public.blocks          enable row level security;
alter table public.content_reports enable row level security;

-- You can see who you've blocked; reports are only for the developer, so the
-- app's roles get no access to them at all.
create policy "Read own blocks" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
revoke all on public.blocks, public.content_reports from anon, authenticated;
grant select on public.blocks to authenticated;

create function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ─── Report ──────────────────────────────────────────────────────────────────

create function public.report_content(p_user uuid, p_kind text, p_ref uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := auth.uid();
  snap text;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_user = me then
    raise exception 'You can''t report yourself' using errcode = 'P0001';
  end if;

  snap := case p_kind
    when 'comment' then (
      select coalesce(c.body, '[voice message] ' || c.audio_path)
      from public.workout_comments c where c.id = p_ref and c.user_id = p_user)
    when 'pep_talk' then (
      select concat_ws(' · ', t.media_kind || ' ' || t.media_path, t.message)
      from public.pep_talks t where t.id = p_ref and t.from_id = p_user and t.to_id = me)
    when 'workout' then (
      select concat_ws(' · ', w.activity_type, w.note, array_to_string(w.photo_paths, ', '))
      from public.workouts w where w.id = p_ref and w.user_id = p_user)
    else (select display_name from public.profiles where id = p_user)
  end;

  insert into public.content_reports (reporter_id, reported_id, kind, ref_id, reason, snapshot)
  values (me, p_user, p_kind, p_ref, p_reason, snap);
end;
$$;

-- ─── Block ───────────────────────────────────────────────────────────────────

create function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_user = me then
    raise exception 'You can''t block yourself' using errcode = 'P0001';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (me, p_user) on conflict do nothing;
  delete from public.partnerships
  where (requester_id = me and addressee_id = p_user) or (requester_id = p_user and addressee_id = me);
end;
$$;

create function public.unblock_user(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;

-- People you've blocked, by first name (you can't read their profile anymore).
create function public.my_blocks()
returns table (user_id uuid, name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id,
         coalesce(nullif(split_part(p.display_name, ' ', 1), ''), 'Someone'),
         b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- ─── Enforcement ─────────────────────────────────────────────────────────────

-- Blocked people can't become partners again, nudge, or send pep talks. The
-- message doesn't say who blocked whom.
create function public.reject_if_blocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a uuid;
  b uuid;
begin
  if tg_table_name = 'partnerships' then
    a := new.requester_id; b := new.addressee_id;
  else
    a := new.from_id; b := new.to_id;
  end if;
  if public.is_blocked_between(a, b) then
    raise exception 'You can''t connect with this person.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger partnerships_reject_blocked
  before insert on public.partnerships
  for each row execute function public.reject_if_blocked();
create trigger nudges_reject_blocked
  before insert on public.nudges
  for each row execute function public.reject_if_blocked();
create trigger pep_talks_reject_blocked
  before insert on public.pep_talks
  for each row execute function public.reject_if_blocked();

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.report_content(uuid, text, uuid, text) from public, anon;
revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.unblock_user(uuid) from public, anon;
revoke execute on function public.my_blocks() from public, anon;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

grant execute on function public.report_content(uuid, text, uuid, text) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocks() to authenticated;
