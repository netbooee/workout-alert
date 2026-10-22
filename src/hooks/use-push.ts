import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';

import { reactionForAction, workoutIdFromUrl } from '@/lib/notification-actions';
import {
  enablePush,
  getPushStatus,
  reactFromNotification,
  registerDevice,
  registerNotificationCategories,
} from '@/lib/push';

const STATUS_KEY = ['push-status'];

/** Current notification permission; rechecked when the app returns from Settings. */
export function usePushStatus() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    });
    return () => sub.remove();
  }, [queryClient]);
  return useQuery({ queryKey: STATUS_KEY, queryFn: getPushStatus });
}

export function useEnablePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enablePush,
    onSettled: () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  });
}

/**
 * Keeps this device registered while signed in (tokens can rotate), and opens
 * the right screen when a notification is tapped, including on cold start.
 * The Cheer and Verify buttons on partner workout pushes save the reaction first.
 */
export function usePushLifecycle() {
  const { data: status } = usePushStatus();
  const queryClient = useQueryClient();

  useEffect(() => {
    registerNotificationCategories().catch((e) => console.warn('Notification buttons failed', e));
  }, []);

  useEffect(() => {
    if (status !== 'granted') return;
    registerDevice().catch((e) => console.warn('Push registration failed', e));
  }, [status]);

  useEffect(() => {
    const last = Notifications.getLastNotificationResponse();
    if (last) respond(last, queryClient);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => respond(r, queryClient));
    return () => sub.remove();
  }, [queryClient]);
}

const handled = new Set<string>();

async function respond(response: Notifications.NotificationResponse, queryClient: QueryClient) {
  // Cold-start responses are replayed on every mount; only act once.
  const id = response.notification.request.identifier;
  if (handled.has(id)) return;
  handled.add(id);
  const url = response.notification.request.content.data?.url;

  const reaction = reactionForAction(response.actionIdentifier);
  const workoutId = workoutIdFromUrl(url);
  if (reaction && workoutId) {
    try {
      await reactFromNotification(workoutId, reaction);
      await queryClient.invalidateQueries({ queryKey: ['social'] });
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  }
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
}
