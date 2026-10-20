-- In-app account deletion (App Store Review Guideline 5.1.1(v)). Deleting the
-- auth user cascades through profiles to every table that references it:
-- workouts, streaks, partnerships, reactions, comments, incentives, XP, push
-- tokens and notifications. The app removes the user's files in the private
-- evidence bucket first, through the Storage API, since storage objects can't
-- be deleted with SQL.

create function public.delete_my_account()
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

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
