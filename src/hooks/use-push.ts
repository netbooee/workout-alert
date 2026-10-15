import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { enablePush, getPushStatus, registerDevice } from '@/lib/push';

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
 */
export function usePushLifecycle() {
  const { data: status } = usePushStatus();

  useEffect(() => {
    if (status !== 'granted') return;
    registerDevice().catch((e) => console.warn('Push registration failed', e));
  }, [status]);

  useEffect(() => {
    const last = Notifications.getLastNotificationResponse();
    if (last) openFromNotification(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      openFromNotification(r.notification),
    );
    return () => sub.remove();
  }, []);
}

const handled = new Set<string>();

function openFromNotification(notification: Notifications.Notification) {
  // Cold-start responses are replayed on every mount; only act once.
  const id = notification.request.identifier;
  if (handled.has(id)) return;
  handled.add(id);
  const url = notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
}
