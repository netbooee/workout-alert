import { describe, expect, it } from 'vitest';

import { levelFor, levelLabel, levelStart, toNextLevel } from './levels';

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

  it('labels the level with its number and title, and what is left', () => {
    const info = levelFor(3243); // 443 XP into level 8 (2,800 to 3,600)
    expect(levelLabel(info)).toBe('Level 8 · Iron');
    expect(toNextLevel(info)).toBe('357 XP to level 9');
    expect(toNextLevel(levelFor(0))).toBe('100 XP to level 2');
    expect(toNextLevel(levelFor(10_000))).toBe('500 XP to level 15');
  });
});
