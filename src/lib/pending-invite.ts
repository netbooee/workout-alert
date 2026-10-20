// An invite link opened before sign-in or onboarding can't route yet (the
// invite screen is only for onboarded users), so its code waits here until
// the partner step of onboarding.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pending-invite-code';

export async function savePendingInvite(code: string): Promise<void> {
  await AsyncStorage.setItem(KEY, code);
}

export async function getPendingInvite(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function clearPendingInvite(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
