// Push notifications: permission, Expo push token registration, and
// foreground display. Sending happens server-side (see the push migration).

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';

const TOKEN_KEY = 'push:token';

// Show banners even while the app is open; partners' activity is the point.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Asks for permission (if not decided yet) and registers this device. */
export async function enablePush(): Promise<PushStatus> {
  if (!Device.isDevice) return 'unsupported';
  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status === 'granted') await registerDevice();
  return status;
}

/** Registers this device's Expo push token for the signed-in user. */
export async function registerDevice(): Promise<void> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error('Push notifications need an EAS project ID (set EAS_PROJECT_ID; see README).');
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_token', { p_token: token });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Stops pushes to this device for the current user (call before signing out). */
export async function unregisterDevice(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await supabase.rpc('unregister_push_token', { p_token: token });
  await AsyncStorage.removeItem(TOKEN_KEY);
}
