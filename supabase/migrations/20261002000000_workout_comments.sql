-- Comments and voice messages on workouts.
--
--   * Anyone who can see a workout (the owner and their partners) can comment
--     with text, a short voice message (up to 30 seconds), or both.
--   * A comment is shown to its author and the author's partners, which always
--     includes the workout owner. Partners of the owner who aren't partners of
--     the commenter don't see it, matching who can play the audio (evidence
--     storage policy: own folder or a partner's folder).
--   * Voice messages live in the private `evidence` bucket under
--     <author id>/comments/<workout id>/<file>.
--   * New comments notify the workout owner and earlier commenters who can see
--     them (so a reply reaches the people in the conversation).

alter table public.profiles
  add column notify_comments boolean not null default true;

create table public.workout_comments (
  id               uuid primary key default gen_random_uuid(),
  workout_id       uuid not null references public.workouts (id) on delete cascade,
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body             text check (char_length(btrim(body)) between 1 and 500),
  audio_path       text,
  audio_duration_ms integer check (audio_duration_ms between 500 and 30500),
  created_at       timestamptz not null default now(),
  constraint workout_comments_has_content check (body is not null or audio_path is not null),
  constraint workout_comments_audio_complete check ((audio_path is null) = (audio_duration_ms is null)),
  -- Only files in your own folder can be attached.
  constraint workout_comments_audio_owner check (
    audio_path is null or split_part(audio_path, '/', 1) = user_id::text
  )
);

create index workout_comments_workout_idx on public.workout_comments (workout_id, created_at);

alter table public.workout_comments enable row level security;

-- `workouts` RLS applies inside these subqueries, so "the workout exists" means
-- "you can see the workout" (yours or a partner's).
create policy "Read comments from yourself and partners" on public.workout_comments
  for select to authenticated
  using (
    exists (select 1 from public.workouts w where w.id = workout_id)
    and (user_id = (select auth.uid()) or public.is_partner((select auth.uid()), user_id))
  );
create policy "Comment on visible workouts" on public.workout_comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id)
  );
-- Authors can delete their comments; owners can clear comments on their workouts.
create policy "Delete own comments or comments on your workout" on public.workout_comments
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  );

grant select, insert, delete on public.workout_comments to authenticated;

-- ─── Notifications ───────────────────────────────────────────────────────────

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('nudge', 'partner_workout', 'partner_request', 'partner_accepted', 'verified',
                    'streak_risk', 'comment'));

create function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.workouts;
  preview text;
begin
  select * into w from public.workouts where id = new.workout_id;

  preview := case
    when new.body is not null then
      '“' || left(btrim(new.body), 120) || case when char_length(btrim(new.body)) > 120 then '…' else '' end || '”'
    else format('🎙️ Voice message (0:%s)', lpad((round(new.audio_duration_ms / 1000.0))::int::text, 2, '0'))
  end;

  insert into public.notifications (user_id, kind, title, body, url)
  select r.id,
         'comment',
         case
           when r.id = w.user_id and new.body is null
             then public.first_name(new.user_id) || ' sent you a voice message 🎙️'
           when r.id = w.user_id
             then public.first_name(new.user_id) || ' commented on your ' || public.activity_label(w.activity_type) || ' 💬'
           when new.user_id = w.user_id
             then public.first_name(new.user_id) || ' replied on their ' || public.activity_label(w.activity_type) || ' 💬'
           else public.first_name(new.user_id) || ' replied on ' || public.first_name(w.user_id) || '’s '
                || public.activity_label(w.activity_type) || ' 💬'
         end,
         preview,
         '/workout/' || w.id
  from public.profiles r
  where r.id <> new.user_id
    and r.notify_comments
    and (
      r.id = w.user_id
      -- Earlier commenters who can see this comment.
      or (
        r.id in (select c.user_id from public.workout_comments c where c.workout_id = w.id and c.id <> new.id)
        and public.is_partner(r.id, new.user_id)
      )
    );
  return null;
end;
$$;

create trigger workout_comments_notify
  after insert on public.workout_comments
  for each row execute function public.notify_comment();
