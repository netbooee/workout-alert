-- Explicit Data API grants for every table the app uses, so the app works
-- whether or not the project "automatically exposes new tables" (Supabase
-- recommends turning that off). Row level security still decides which rows
-- each user can see; these grants only allow the operations the app performs.

grant select, update                 on public.profiles       to authenticated;
grant select, insert, update, delete on public.workouts       to authenticated;
grant select, insert, update         on public.daily_activity to authenticated;
grant select                         on public.streaks        to authenticated;
grant select                         on public.streak_weeks   to authenticated;

-- Helper functions called from RLS policies (tables and storage) run with the
-- caller's privileges, so signed-in users need to be able to execute them.
grant execute on function public.is_partner(uuid, uuid)   to authenticated;
grant execute on function public.is_connected(uuid, uuid) to authenticated;
