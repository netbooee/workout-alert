import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import type { Partner, ReactionKind, Workout } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// Everything social lives under ['social'] so one invalidation refreshes it.

/** Supabase returns data or an error; throw the error so React Query sees it. */
function unwrap<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

/** Matches the server's rate limit in nudge_partner. */
const NUDGE_COOLDOWN_MS = 12 * 3600 * 1000;

export type PartnerState = Partner & { recently_nudged: boolean };

export function usePartners() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['social', 'partners', userId],
    enabled: !!userId,
    queryFn: async (): Promise<PartnerState[]> => {
      const now = Date.now();
      return unwrap(await supabase.rpc('my_partners')).map((p) => ({
        ...p,
        recently_nudged:
          !!p.last_nudged_at && now - new Date(p.last_nudged_at).getTime() < NUDGE_COOLDOWN_MS,
      }));
    },
  });
}

export function useLeague() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['social', 'league', userId],
    enabled: !!userId,
    queryFn: async () => unwrap(await supabase.rpc('weekly_league', {})),
  });
}

export interface FeedItem {
  workout: Workout;
  reactions: { kind: ReactionKind; user_id: string }[];
}

async function withReactions(workouts: Workout[]): Promise<FeedItem[]> {
  if (!workouts.length) return [];
  const reactions = unwrap(
    await supabase
      .from('reactions')
      .select('workout_id, kind, user_id')
      .in(
        'workout_id',
        workouts.map((w) => w.id),
      ),
  );
  return workouts.map((workout) => ({
    workout,
    reactions: reactions.filter((r) => r.workout_id === workout.id),
  }));
}

/** Your partners' recent workouts (RLS limits visibility to accepted partners). */
export function usePartnerFeed() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['social', 'feed', userId],
    enabled: !!userId,
    queryFn: async () => {
      const workouts = unwrap(
        await supabase
          .from('workouts')
          .select('*')
          .neq('user_id', userId!)
          .order('started_at', { ascending: false })
          .limit(30),
      );
      return withReactions(workouts);
    },
  });
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: ['social', 'workout', id],
    queryFn: async () => {
      const workout = unwrap(await supabase.from('workouts').select('*').eq('id', id).single());
      const [item] = await withReactions([workout]);
      return item;
    },
  });
}

/** Names for everyone you can see: you plus partners. */
export function useNames(): (userId: string) => string {
  const { profile } = useAuth();
  const { data: partners } = usePartners();
  return (userId) => {
    if (userId === profile?.id) return 'You';
    return partners?.find((p) => p.partner_id === userId)?.display_name ?? 'Partner';
  };
}

export function useUnseenNudges() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['social', 'nudges', userId],
    enabled: !!userId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('nudges')
          .select('*')
          .eq('to_id', userId!)
          .is('seen_at', null)
          .gte('created_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
          .order('created_at', { ascending: false }),
      ),
  });
}

export function useXpTotal() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['social', 'xp', userId],
    enabled: !!userId,
    queryFn: async () => {
      const rows = unwrap(await supabase.from('xp_events').select('amount').eq('user_id', userId!));
      return rows.reduce((sum, r) => sum + r.amount, 0);
    },
  });
}

function useSocialMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['social'] }),
  });
}

export function useRequestPartner() {
  return useSocialMutation(async (code: string) =>
    unwrap(await supabase.rpc('request_partner', { p_code: code })),
  );
}

export function useRespondToPartner() {
  return useSocialMutation(async ({ id, accept }: { id: string; accept: boolean }) =>
    unwrap(await supabase.rpc('respond_to_partner', { p_id: id, p_accept: accept })),
  );
}

export function useRemovePartner() {
  return useSocialMutation(async (partnershipId: string) =>
    unwrap(await supabase.from('partnerships').delete().eq('id', partnershipId)),
  );
}

export function useNudge() {
  return useSocialMutation(async (partnerId: string) =>
    unwrap(await supabase.rpc('nudge_partner', { p_partner: partnerId })),
  );
}

export function useMarkNudgesSeen() {
  return useSocialMutation(async (ids: string[]) =>
    unwrap(await supabase.from('nudges').update({ seen_at: new Date().toISOString() }).in('id', ids)),
  );
}

export function useToggleReaction() {
  const userId = useAuth().session?.user.id;
  return useSocialMutation(
    async ({ workoutId, kind, on }: { workoutId: string; kind: ReactionKind; on: boolean }) =>
      on
        ? unwrap(await supabase.from('reactions').insert({ workout_id: workoutId, kind }))
        : unwrap(
            await supabase
              .from('reactions')
              .delete()
              .match({ workout_id: workoutId, kind, user_id: userId! }),
          ),
  );
}
