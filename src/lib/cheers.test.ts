import { describe, expect, it } from 'vitest';

import { needsCheer, whenLabel } from './cheers';

const me = 'me';
// Thursday Oct 22 2026, 9am local.
const now = new Date(2026, 9, 22, 9, 0);
const at = (day: number, hour = 7) => new Date(2026, 9, day, hour, 0).toISOString();
const item = (user: string, startedAt: string, reactions: { kind: 'clap' | 'verified'; user_id: string }[] = []) => ({
  workout: { user_id: user, started_at: startedAt },
  reactions,
});

describe('needsCheer', () => {
  it('lists partner workouts from the last 3 days you have not reacted to, newest first', () => {
    const items = [item('tony', at(21)), item('tony', at(22)), item('tony', at(20))];
    expect(needsCheer(items, me, now).map((i) => i.workout.started_at)).toEqual([at(22), at(21), at(20)]);
  });

  it('drops older workouts', () => {
    expect(needsCheer([item('tony', at(19, 23))], me, now)).toEqual([]);
  });

  it('drops your own workouts', () => {
    expect(needsCheer([item(me, at(22))], me, now)).toEqual([]);
  });

  it('treats any reaction from you, including Verify, as done', () => {
    expect(needsCheer([item('tony', at(22), [{ kind: 'verified', user_id: me }])], me, now)).toEqual([]);
    expect(needsCheer([item('tony', at(22), [{ kind: 'clap', user_id: 'ana' }])], me, now)).toHaveLength(1);
  });
});

describe('whenLabel', () => {
  it('says Today and Yesterday', () => {
    expect(whenLabel(at(22), now)).toMatch(/^Today /);
    expect(whenLabel(at(21), now)).toMatch(/^Yesterday /);
    expect(whenLabel(at(20), now)).not.toMatch(/^(Today|Yesterday)/);
  });
});
