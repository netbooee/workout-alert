-- The final table of your most recent finished league week you haven't seen
-- yet, for the end-of-week screen ("You finished #3 last week"). Same privacy
-- as my_public_league: names or nicknames, buddies, XP and a per-group key.

create function public.my_league_result_table()
returns table (member_key text, name text, mascot text, xp integer, rank integer, is_me boolean, result text)
language sql
stable
security definer
set search_path = ''
as $$
  with last as (
    select m.cohort_id
    from public.league_members m
    join public.league_cohorts c on c.id = m.cohort_id
    where m.user_id = auth.uid() and c.closed_at is not null and not m.result_seen
    order by m.week_start desc
    limit 1
  )
  select md5(m.user_id::text || m.cohort_id::text),
         coalesce(lp.nickname, split_part(coalesce(p.display_name, 'Player'), ' ', 1)),
         p.mascot::text,
         m.final_xp,
         m.final_rank,
         m.user_id = auth.uid(),
         m.result
  from last
  join public.league_members m on m.cohort_id = last.cohort_id
  join public.profiles p on p.id = m.user_id
  left join public.league_players lp on lp.user_id = m.user_id
  order by m.final_rank;
$$;

revoke execute on function public.my_league_result_table() from public, anon;
grant execute on function public.my_league_result_table() to authenticated;
