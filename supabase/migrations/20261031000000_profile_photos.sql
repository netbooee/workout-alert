-- Profile photos. Each person may upload one photo, shown instead of their
-- initials to themselves and the people they're connected with (partners and
-- pending requests, the same people who can read their profile). Public
-- leagues keep showing buddies, never photos.
--
-- profiles.avatar_url has existed since the start but was never filled in.
-- It now holds the photo's path in the private avatars bucket (not a URL:
-- the app turns it into a short-lived signed link). my_partners and
-- partner_league already return it, so partners' photos need no new query.

update public.profiles set avatar_url = null where avatar_url is not null;

-- Only a file in your own folder of the avatars bucket.
alter table public.profiles add constraint profiles_avatar_own_folder
  check (avatar_url is null or avatar_url ~ ('^' || id::text || '/avatar-[0-9]+\.jpg$'));

-- Private bucket; files live under <user id>/avatar-<timestamp>.jpg. A new
-- photo gets a new name, so cached copies never show the old one.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "Upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "View own and connected avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_connected((select auth.uid()), ((storage.foldername(name))[1])::uuid)
    )
  );
