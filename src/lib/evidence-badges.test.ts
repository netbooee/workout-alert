import { describe, expect, it } from 'vitest';

import { evidenceBadges } from './evidence-badges';

const base = { source: 'healthkit' as const, source_name: null, avg_hr: null, photo_paths: [] };

describe('evidenceBadges', () => {
  it('treats watch heart rate as strong evidence', () => {
    expect(evidenceBadges({ ...base, source_name: "Sam's Apple Watch", avg_hr: 142 })).toEqual([
      { icon: 'heart.fill', label: "Heart rate from Sam's Apple Watch", strength: 'strong' },
    ]);
  });

  it('falls back to Apple Health when the source is unknown', () => {
    expect(evidenceBadges(base)[0]).toMatchObject({ label: 'Recorded by Apple Health', strength: 'medium' });
  });

  it('adds photos alongside device data', () => {
    const badges = evidenceBadges({ ...base, avg_hr: 120, photo_paths: ['a', 'b'] });
    expect(badges.map((b) => b.label)).toEqual(['Heart rate from Apple Health', '2 photos']);
  });

  it('marks manual workouts without photos as self-reported', () => {
    expect(evidenceBadges({ ...base, source: 'manual' })).toEqual([
      { icon: 'hand.raised.fill', label: 'Self-reported', strength: 'weak' },
    ]);
  });

  it('counts a photo on a manual workout as medium evidence', () => {
    expect(evidenceBadges({ ...base, source: 'manual', photo_paths: ['a'] })).toEqual([
      { icon: 'camera.fill', label: '1 photo', strength: 'medium' },
    ]);
  });
});
