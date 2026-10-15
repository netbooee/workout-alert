// Light / dark / follow-the-phone preference. Theme colors are iOS dynamic
// colors (see constants/theme.ts), so overriding the app's appearance here
// re-colors every screen without re-rendering it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';

export type AppearancePref = 'system' | 'light' | 'dark';

const KEY = 'appearance';

function apply(pref: AppearancePref) {
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

async function load(): Promise<AppearancePref> {
  const saved = await AsyncStorage.getItem(KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

/** Applies the saved preference. Call once at startup. */
export async function restoreAppearance() {
  const pref = await load();
  if (pref !== 'system') apply(pref);
}

export function useAppearancePref() {
  const [pref, setPref] = useState<AppearancePref>('system');

  useEffect(() => {
    load().then(setPref);
  }, []);

  const update = (next: AppearancePref) => {
    setPref(next);
    apply(next);
    AsyncStorage.setItem(KEY, next);
  };

  return [pref, update] as const;
}
