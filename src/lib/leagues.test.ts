import { describe, expect, it } from 'vitest';

import { demoteCount, nicknameProblem, promoteCount, resultLine, tierInfo, zoneFor } from './leagues';

describe('league zones', () => {
  it('scales promotion and demotion to the group size', () => {
    expect([promoteCount(20), demoteCount(20)]).toEqual([5, 3]);
    expect([promoteCount(6), demoteCount(6)]).toEqual([2, 0]);
    expect([promoteCount(1), demoteCount(1)]).toEqual([1, 0]);
  });

  it('places ranks into zones', () => {
    expect(zoneFor(1, 20, 1, 100)).toBe('up');
    expect(zoneFor(6, 20, 1, 100)).toBe('stay');
    expect(zoneFor(20, 20, 1, 5)).toBe('stay'); // nobody drops out of Spark
    expect(zoneFor(18, 20, 2, 5)).toBe('down');
    expect(zoneFor(1, 20, 5, 900)).toBe('stay'); // nowhere higher than Inferno
    expect(zoneFor(1, 20, 2, 0)).toBe('down'); // no XP, no promotion
  });
});

describe('league copy', () => {
  it('names tiers and results', () => {
    expect(tierInfo(3).name).toBe('Flame');
    expect(tierInfo(9).name).toBe('Inferno');
    expect(resultLine('up', 2)).toBe('You moved up to Ember 🔸');
    expect(resultLine('stay', 5)).toBe('You held on in Inferno 🌋');
  });

  it('checks nicknames like the database does', () => {
    expect(nicknameProblem('')).toBeNull();
    expect(nicknameProblem('A')).toBe('Use at least 2 characters');
    expect(nicknameProblem('x'.repeat(21))).toBe('Keep it to 20 characters');
    expect(nicknameProblem(' Speedy ')).toBeNull();
  });
});
