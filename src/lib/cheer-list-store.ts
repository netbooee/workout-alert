// Which "Cheer on your partners" rows to keep showing or hide. Dismissed rows
// are remembered on this phone; kept rows (on screen this visit) last until
// the app restarts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const DISMISSED_KEY = 'cheer:dismissed';
/** Old ids age out of the cheer list after a few days anyway; this just bounds storage. */
const MAX_DISMISSED = 200;

let dismissed: ReadonlySet<string> = new Set();
let keep: ReadonlySet<string> = new Set();
let snapshot = { dismissed, keep };
const listeners = new Set<() => void>();

function publish() {
  snapshot = { dismissed, keep };
  listeners.forEach((l) => l());
}

AsyncStorage.getItem(DISMISSED_KEY)
  .then((raw) => {
    if (!raw) return;
    dismissed = new Set([...(JSON.parse(raw) as string[]), ...dismissed]);
    publish();
  })
  .catch(() => {});

export function useCheerListState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}

/** Rows on screen stay put after a cheer, so Verify is still in reach. */
export function keepCheerRows(ids: string[]) {
  if (ids.every((id) => keep.has(id))) return;
  keep = new Set([...keep, ...ids]);
  publish();
}

export function dismissCheerRow(id: string) {
  dismissed = new Set([...dismissed, id]);
  publish();
  AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed].slice(-MAX_DISMISSED))).catch(() => {});
}
