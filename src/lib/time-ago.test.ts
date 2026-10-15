import { describe, expect, it } from 'vitest';

import { timeAgo } from './time-ago';

const now = new Date(2026, 9, 15, 12, 0); // Thursday

describe('timeAgo', () => {
  it('uses minutes and hours for today', () => {
    expect(timeAgo(new Date(2026, 9, 15, 11, 59, 30), now)).toBe('now');
    expect(timeAgo(new Date(2026, 9, 15, 11, 55), now)).toBe('5m');
    expect(timeAgo(new Date(2026, 9, 15, 9, 0), now)).toBe('3h');
  });

  it('uses the weekday for this week and the date after that', () => {
    expect(timeAgo(new Date(2026, 9, 13, 8, 0), now)).toBe('Tue');
    expect(timeAgo(new Date(2026, 9, 3, 8, 0), now)).toBe('Oct 3');
  });
});
