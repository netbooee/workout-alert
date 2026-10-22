import { describe, expect, it } from 'vitest';

import { needsCheer, untouched, whenLabel } from './cheers';

const me = 'me';
// Thursday Oct 22 2026, 9am local.
const now = new Date(2026, 9, 22, 9, 0);
const at = (day: number, hour = 7) => new Date(2026, 9, day, hour, 0).toISOString();
let n = 0;
const item = (user: string, startedAt: string, reactions: { kind: 'clap' | 'verified'; user_id: string }[] = []) => ({
  workout: { id: `w${++n}`, user_id: user, started_at: startedAt },
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

  it('is done once you verify, wherever you did it', () => {
    const w = item('tony', at(22), [{ kind: 'verified', user_id: me }]);
    expect(needsCheer([w], me, now, { keep: new Set([w.workout.id]) })).toEqual([]);
  });

  it('keeps a row you just cheered on screen so you can still verify', () => {
    const w = item('tony', at(22), [{ kind: 'clap', user_id: me }]);
    expect(needsCheer([w], me, now, { keep: new Set([w.workout.id]) })).toHaveLength(1);
    // Next visit, a cheer alone counts as done.
    expect(needsCheer([w], me, now)).toEqual([]);
  });

  it('drops dismissed rows', () => {
    const w = item('tony', at(22));
    expect(needsCheer([w], me, now, { dismissed: new Set([w.workout.id]) })).toEqual([]);
  });

  it('ignores other people’s reactions', () => {
    expect(needsCheer([item('tony', at(22), [{ kind: 'clap', user_id: 'ana' }])], me, now)).toHaveLength(1);
  });
});

describe('untouched', () => {
  it('counts only rows you have not reacted to', () => {
    const items = [item('tony', at(22)), item('tony', at(22), [{ kind: 'clap', user_id: me }])];
    expect(untouched(items, me)).toHaveLength(1);
  });
});

describe('whenLabel', () => {
  it('says Today and Yesterday', () => {
    expect(whenLabel(at(22), now)).toMatch(/^Today /);
    expect(whenLabel(at(21), now)).toMatch(/^Yesterday /);
    expect(whenLabel(at(20), now)).not.toMatch(/^(Today|Yesterday)/);
  });
});
