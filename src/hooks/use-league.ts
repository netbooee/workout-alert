import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Public leagues live under ['league'] so one invalidation refreshes them.

function unwrap<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

/** Your public league settings, or null if you've never opted in. */
export function useLeagueSettings() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['league', 'settings', userId],
    enabled: !!userId,
    queryFn: async () =>
      unwrap(await supabase.from('league_players').select('*').eq('user_id', userId!).maybeSingle()) ?? null,
  });
}

/** Your group this week, best first. Empty until you've opted in and earned XP this week. */
export function usePublicLeague(enabled = true) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['league', 'table', userId],
    enabled: !!userId && enabled,
    queryFn: async () => unwrap(await supabase.rpc('my_public_league', {})),
  });
}

/** How your last finished week went, if you haven't seen it yet. */
export function useLeagueResult() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['league', 'result', userId],
    enabled: !!userId,
    queryFn: async () => unwrap(await supabase.rpc('my_league_result')).at(0) ?? null,
  });
}

/** The final table of that week, for the end-of-week screen. */
export function useLeagueResultTable(enabled: boolean) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['league', 'result-table', userId],
    enabled: !!userId && enabled,
    queryFn: async () => unwrap(await supabase.rpc('my_league_result_table')),
  });
}

function useLeagueMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['league'] }),
  });
}

export function useSetPublicLeague() {
  return useLeagueMutation(async ({ on, nickname }: { on: boolean; nickname?: string | null }) =>
    unwrap(await supabase.rpc('set_public_league', { p_on: on, p_nickname: nickname?.trim() || null })),
  );
}

export function useMarkLeagueResultSeen() {
  return useLeagueMutation(async () => unwrap(await supabase.rpc('mark_league_result_seen')));
}

export function useReportLeagueMember() {
  return useLeagueMutation(async ({ key, reason }: { key: string; reason?: string }) =>
    unwrap(await supabase.rpc('report_league_member', { p_member_key: key, p_reason: reason ?? null })),
  );
}

/** Weeks whose result screen already opened this session. */
const shownResults = new Set<string>();

/**
 * Opens the end-of-week league screen once when a finished week's result is
 * waiting, a moment after launch so it follows any greeting.
 */
export function useLeagueResultPopup() {
  const { data: result } = useLeagueResult();
  const week = result?.week_start;
  useEffect(() => {
    if (!week || shownResults.has(week)) return;
    const id = setTimeout(() => {
      shownResults.add(week);
      router.push('/league-result');
    }, 1500);
    return () => clearTimeout(id);
  }, [week]);
}
