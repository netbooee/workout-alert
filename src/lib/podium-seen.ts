// Which group's medal ceremony you've already watched, per finished week, so it
// plays once: the first time you open the group after the week ends.

import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: string, groupId: string) => `podium-seen:${userId}:${groupId}`;

export async function podiumSeen(userId: string, groupId: string, week: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId, groupId))) === week;
  } catch {
    return true; // If storage fails, don't replay the ceremony every visit.
  }
}

export async function markPodiumSeen(userId: string, groupId: string, week: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId, groupId), week);
  } catch {
    // Worst case it plays once more.
  }
}
