// Short sound effects for celebrations, cheers and nudges, in the spirit of
// Duolingo's. The sounds are made by scripts/generate-sounds.py. They follow
// the ring/silent switch, mix with music, and can be turned off in Settings.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';

const SOURCES = {
  success: require('@/assets/sounds/success.wav'),
  levelup: require('@/assets/sounds/levelup.wav'),
  xp: require('@/assets/sounds/xp.wav'),
  streak: require('@/assets/sounds/streak.wav'),
  pop: require('@/assets/sounds/pop.wav'),
  burst: require('@/assets/sounds/burst.wav'),
  nudge: require('@/assets/sounds/nudge.wav'),
  banner: require('@/assets/sounds/banner.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const KEY = 'sounds-enabled';
let enabled = true;
/** Voice messages switch the session to play in silent mode; effects switch it back. */
let effectsMode = false;
const players: Partial<Record<SoundName, AudioPlayer>> = {};

/** Reads the setting. Call once at startup. */
export async function restoreSounds() {
  enabled = (await AsyncStorage.getItem(KEY).catch(() => null)) !== 'off';
}

/** Voice messages and recording should play even on silent; call before using them. */
export function noteVoiceAudioMode() {
  effectsMode = false;
}

export function playSound(name: SoundName) {
  if (!enabled) return;
  (async () => {
    if (!effectsMode) {
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
      effectsMode = true;
    }
    const player = (players[name] ??= createAudioPlayer(SOURCES[name]));
    await player.seekTo(0);
    player.play();
  })().catch(() => {});
}

export function useSoundsPref() {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    restoreSounds().then(() => setOn(enabled));
  }, []);
  const update = (next: boolean) => {
    enabled = next;
    setOn(next);
    AsyncStorage.setItem(KEY, next ? 'on' : 'off').catch(() => {});
    if (next) playSound('pop');
  };
  return [on, update] as const;
}
