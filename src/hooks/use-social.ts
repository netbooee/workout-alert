import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '@/lib/auth';
import { useCheerListState } from '@/lib/cheer-list-store';
import type { IncomingCheer } from '@/lib/cheer-banner';
import { CHEER_KINDS, needsCheer } from '@/lib/cheers';
import type { Partner, ReactionKind, Workout } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { startOfWeek } from '@/lib/week';
import { workoutLabel } from '@/lib/workout-types';

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
  /** Other devices whose copies of this workout were folded into it. */
  alsoRecordedBy: string[];
}

async function withReactions(workouts: Workout[]): Promise<FeedItem[]> {
  if (!workouts.length) return [];
  const ids = workouts.map((w) => w.id);
  const [reactions, copies] = await Promise.all([
    supabase.from('reactions').select('workout_id, kind, user_id').in('workout_id', ids).then(unwrap),
    supabase.from('workouts').select('duplicate_of, source_name').in('duplicate_of', ids).then(unwrap),
  ]);
  return workouts.map((workout) => ({
    workout,
    reactions: reactions.filter((r) => r.workout_id === workout.id),
    alsoRecordedBy: copies.filter((c) => c.duplicate_of === workout.id).map((c) => c.source_name ?? ''),
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
          .is('duplicate_of', null)
          // Workouts under their owner's "What counts" bar stay out of the feed.
          .eq('counted', true)
          .order('started_at', { ascending: false })
          .limit(30),
      );
      return withReactions(workouts);
    },
  });
}

/** Partners' recent workouts still waiting on you (see needsCheer), newest first. */
export function useCheerQueue(): FeedItem[] {
  const me = useAuth().session?.user.id;
  const { data } = usePartnerFeed();
  const state = useCheerListState();
  return me && data ? needsCheer(data, me, new Date(), state) : [];
}

/** How many partner workouts you haven't touched yet (the Partners tab badge). */
export function useCheerBadgeCount(): number {
  const me = useAuth().session?.user.id;
  const { data } = usePartnerFeed();
  const { dismissed } = useCheerListState();
  return me && data ? needsCheer(data, me, new Date(), { dismissed }).length : 0;
}

/** Your accepted partners' workouts that count this week, for the crew card on Home. */
export function useCrewWeek(partnerIds: string[]) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['social', 'crew-week', userId, ...partnerIds],
    enabled: !!userId && partnerIds.length > 0,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('workouts')
          .select('id, user_id, activity_type, started_at, duration_s, counted')
          .in('user_id', partnerIds)
          .is('duplicate_of', null)
          .eq('counted', true)
          .gte('started_at', startOfWeek(new Date()).toISOString()),
      ),
  });
}

/** One partner's recent workouts that count, with reactions. */
export function usePartnerWorkouts(partnerId: string) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['social', 'partner-workouts', userId, partnerId],
    enabled: !!userId && !!partnerId,
    queryFn: async () => {
      const workouts = unwrap(
        await supabase
          .from('workouts')
          .select('*')
          .eq('user_id', partnerId)
          .is('duplicate_of', null)
          .eq('counted', true)
          .order('started_at', { ascending: false })
          .limit(20),
      );
      return withReactions(workouts);
    },
  });
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: ['social', 'workout', id],
    enabled: !!id,
    queryFn: async () => {
      let workout = unwrap(await supabase.from('workouts').select('*').eq('id', id).single());
      // A link to a copy another device's richer record replaced opens the one that counts.
      if (workout.duplicate_of) {
        workout = unwrap(await supabase.from('workouts').select('*').eq('id', workout.duplicate_of).single());
      }
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

/** Cheer a workout with one emoji, replacing any cheer you already gave it (verifying is separate). */
export function useSetCheer() {
  const userId = useAuth().session?.user.id;
  return useSocialMutation(async ({ workoutId, kind }: { workoutId: string; kind: ReactionKind }) => {
    unwrap(
      await supabase
        .from('reactions')
        .delete()
        .match({ workout_id: workoutId, user_id: userId! })
        .in('kind', CHEER_KINDS),
    );
    return unwrap(await supabase.from('reactions').insert({ workout_id: workoutId, kind }));
  });
}

const cheersSeenKey = (userId: string) => `cheers-seen:${userId}`;

/**
 * Cheers and verifications on your workouts since you last saw the banner on
 * Home. The first time on a device it only records a starting point. Kept
 * until dismissed (no refetching) so the banner doesn't vanish mid-read.
 */
export function useNewCheers() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['social', 'new-cheers', userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async (): Promise<IncomingCheer[]> => {
      const seen = await AsyncStorage.getItem(cheersSeenKey(userId!));
      if (!seen) {
        await AsyncStorage.setItem(cheersSeenKey(userId!), new Date().toISOString());
        return [];
      }
      const mine = unwrap(
        await supabase
          .from('workouts')
          .select('id, activity_type')
          .eq('user_id', userId!)
          .gte('started_at', new Date(Date.now() - 14 * 86400_000).toISOString()),
      );
      if (!mine.length) return [];
      const reactions = unwrap(
        await supabase
          .from('reactions')
          .select('workout_id, user_id, kind, created_at')
          .in('workout_id', mine.map((w) => w.id))
          .neq('user_id', userId!)
          .gt('created_at', seen)
          .order('created_at', { ascending: false }),
      );
      return reactions.map((r) => ({
        ...r,
        workout: workoutLabel(mine.find((w) => w.id === r.workout_id)?.activity_type ?? ''),
      }));
    },
  });
}

/** Hide the banner and remember what's been seen, up to the newest shown. */
export function useDismissNewCheers() {
  const userId = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  return useCallback(
    (newest: string | undefined) => {
      if (!userId) return;
      queryClient.setQueryData(['social', 'new-cheers', userId], []);
      if (newest) AsyncStorage.setItem(cheersSeenKey(userId), newest).catch(() => {});
    },
    [userId, queryClient],
  );
}

/** Who verified one of your recent workouts in the last two days. */
export function useRecentVerifications(workoutIds: string[]) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['social', 'verifications', userId, ...workoutIds],
    enabled: !!userId && workoutIds.length > 0,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('reactions')
          .select('user_id, created_at')
          .eq('kind', 'verified')
          .neq('user_id', userId!)
          .in('workout_id', workoutIds)
          .gte('created_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
          .order('created_at', { ascending: false }),
      ),
  });
}
