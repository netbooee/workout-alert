// An invite link opened before sign-in or onboarding can't route yet (the
// invite screens are only for onboarded users), so its code waits here: a
// partner invite until the partner step of onboarding, a group invite until
// onboarding is done.

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

const GROUP_KEY = 'pending-group-code';

export async function savePendingGroupInvite(code: string): Promise<void> {
  await AsyncStorage.setItem(GROUP_KEY, code);
}

/** The waiting group code, if any, cleared as it's read so it opens once. */
export async function takePendingGroupInvite(): Promise<string | null> {
  const code = await AsyncStorage.getItem(GROUP_KEY);
  if (code) await AsyncStorage.removeItem(GROUP_KEY);
  return code;
}
