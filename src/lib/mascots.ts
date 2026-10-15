// The characters you can pick as your streak buddy. Every character shows the same six
// moods (decided in lib/lotl.ts) with the same signature on its face, so the widget and
// your partners can read your week at a glance whichever one you choose.
// Pure (no React Native imports) so it stays unit-testable and widget-shareable.

import type { LotlMood } from '@/lib/lotl';

export type MascotKind = 'lotl' | 'capybara' | 'sloth' | 'red_panda';

export const MASCOTS: Record<MascotKind, { name: string; species: string; vibe: string }> = {
  lotl: { name: 'Lotl', species: 'Axolotl', vibe: 'Playful and bubbly' },
  capybara: { name: 'Capi', species: 'Capybara', vibe: 'Calm, zero pressure' },
  sloth: { name: 'Lento', species: 'Sloth', vibe: 'Slow and steady still counts' },
  red_panda: { name: 'Canela', species: 'Red panda', vibe: 'Cozy and cheerful' },
};

export const MASCOT_KINDS = Object.keys(MASCOTS) as MascotKind[];

/**
 * How perky each mood is, from -1 (droopy) to 1 (all the way up). Lotl's gills,
 * the animals' ears, and the sloth's arms all follow it.
 */
export const MOOD_LIFT: Record<LotlMood, number> = {
  blazing: 1,
  happy: 0.6,
  ready: 0.3,
  worried: -0.6,
  fired_up: 0.9,
  sleepy: -1,
};
