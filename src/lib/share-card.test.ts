import { describe, expect, it } from 'vitest';

import { cardHeadline, shareCaption } from './share-card';

describe('share cards', () => {
  it('headlines each kind of card', () => {
    expect(cardHeadline({ kind: 'streak', weeks: 12 })).toBe('12-week streak');
    expect(cardHeadline({ kind: 'league', tier: 4, movedUp: true })).toBe('Moved up to Blaze');
    expect(cardHeadline({ kind: 'league', tier: 2, movedUp: false, rank: 3 })).toBe('Ember League');
  });

  it('adds your invite link to the caption', () => {
    expect(shareCaption({ kind: 'workout', label: 'Strength', minutes: 45, xp: 62, streakWeeks: 5 }, 'ABC123')).toBe(
      '45 min of strength done 💪 5-week streak 🔥 on Sigamos. Join me: https://sigamos.cloud/invite/ABC123',
    );
    expect(shareCaption({ kind: 'league', tier: 4, movedUp: true }, null)).toBe(
      'I moved up to the Blaze League ☄️ on Sigamos.',
    );
  });
});
