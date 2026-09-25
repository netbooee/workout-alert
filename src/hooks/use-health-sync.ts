import { subscribeToChanges, WorkoutTypeIdentifier } from '@kingstinct/react-native-healthkit';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/auth';
import { healthAvailable } from '@/lib/health/healthkit';
import { syncHealthData } from '@/lib/health/sync';

const MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Syncs HealthKit on mount, whenever the app returns to the foreground
 * (throttled), and when HealthKit reports a new workout while the app is open.
 * Returns a `sync` function for pull-to-refresh.
 */
export function useHealthSync() {
  const userId = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  const lastRun = useRef(0);

  const { mutate, isPending, error } = useMutation({
    mutationFn: (uid: string) => syncHealthData(uid),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['home'] }),
  });

  const sync = useCallback(
    (force = false) => {
      if (!userId || !healthAvailable()) return;
      if (!force && Date.now() - lastRun.current < MIN_INTERVAL_MS) return;
      lastRun.current = Date.now();
      mutate(userId);
    },
    [userId, mutate],
  );

  useEffect(() => {
    sync();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const subscription = healthAvailable()
      ? subscribeToChanges(WorkoutTypeIdentifier, () => sync(true))
      : null;
    return () => {
      appState.remove();
      subscription?.remove();
    };
  }, [sync]);

  return { sync: () => sync(true), syncing: isPending, error };
}
