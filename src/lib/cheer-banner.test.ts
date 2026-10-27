import { describe, expect, it } from 'vitest';

import { cheerBanner, type IncomingCheer } from './cheer-banner';

const names: Record<string, string> = { s: 'Sharon', t: 'Tony', m: 'Monica' };
const first = (id: string) => names[id] ?? 'Partner';
const c = (user_id: string, kind: IncomingCheer['kind'], workout_id = 'w1', minute = 0): IncomingCheer => ({
  user_id,
  kind,
  workout_id,
  workout: 'Strength',
  created_at: `2026-10-27T12:0${minute}:00Z`,
});

describe('cheerBanner', () => {
  it('says nothing with nothing new', () => {
    expect(cheerBanner([], first)).toBeNull();
  });

  it('names one cheer with its emoji', () => {
    expect(cheerBanner([c('s', 'fire')], first)).toEqual({
      text: 'Sharon 🔥 cheered your strength',
      who: 's',
      workoutId: 'w1',
    });
  });

  it('puts a verification first', () => {
    expect(cheerBanner([c('s', 'clap', 'w1', 2), c('t', 'verified', 'w1', 1)], first)?.text).toBe(
      'Sharon and Tony verified your strength',
    );
  });

  it('counts people and workouts', () => {
    expect(cheerBanner([c('s', 'clap'), c('t', 'clap'), c('m', 'fire')], first)?.text).toBe(
      'Sharon and 2 others cheered your strength',
    );
    expect(cheerBanner([c('s', 'clap', 'w1'), c('s', 'fire', 'w2')], first)).toMatchObject({
      text: 'Sharon cheered 2 of your workouts 🎉',
      workoutId: null,
    });
  });
});
