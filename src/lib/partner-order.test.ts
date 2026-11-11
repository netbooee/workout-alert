import { describe, expect, it } from 'vitest';

import { orderPartners } from './partner-order';

const p = (display_name: string, days: number, goal: number, extra: { resting?: boolean; nudged?: boolean } = {}) => ({
  display_name,
  this_week_days: days,
  this_week_goal: goal,
  resting: extra.resting ?? false,
  recently_nudged: extra.nudged ?? false,
});

describe('orderPartners', () => {
  it('puts whoever needs a nudge first, then nudged, resting and done', () => {
    const order = orderPartners([
      p('Maria', 3, 3),
      p('Lee', 0, 4, { nudged: true }),
      p('Ana', 0, 3, { resting: true }),
      p('Sam', 1, 3),
    ]).map((x) => x.display_name);
    expect(order).toEqual(['Sam', 'Lee', 'Ana', 'Maria']);
  });

  it('puts the furthest behind first, then sorts by name', () => {
    const order = orderPartners([p('Zoe', 2, 3), p('Bea', 0, 3), p('Cal', 2, 3)]).map((x) => x.display_name);
    expect(order).toEqual(['Bea', 'Cal', 'Zoe']);
  });

  it('leaves the input alone', () => {
    const input = [p('B', 3, 3), p('A', 0, 3)];
    orderPartners(input);
    expect(input.map((x) => x.display_name)).toEqual(['B', 'A']);
  });
});
