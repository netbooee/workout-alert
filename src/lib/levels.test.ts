import { describe, expect, it } from 'vitest';

import { levelFor, levelStart } from './levels';

describe('levels', () => {
  it('uses a growing curve', () => {
    expect([1, 2, 3, 5, 10].map(levelStart)).toEqual([0, 100, 300, 1000, 4500]);
  });

  it('starts at level 1 with no XP', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'Rookie', into: 0, span: 100, progress: 0 });
  });

  it('levels up exactly at the threshold', () => {
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(299).level).toBe(2);
    expect(levelFor(300)).toMatchObject({ level: 3, title: 'Regular', into: 0, span: 300 });
  });

  it('reports progress within a level', () => {
    expect(levelFor(1250)).toMatchObject({ level: 5, title: 'Grinder', into: 250, span: 500, progress: 0.5 });
  });

  it('handles big totals', () => {
    const info = levelFor(1_000_000);
    expect(levelStart(info.level)).toBeLessThanOrEqual(1_000_000);
    expect(levelStart(info.level + 1)).toBeGreaterThan(1_000_000);
    expect(info.title).toBe('Legend');
  });
});
