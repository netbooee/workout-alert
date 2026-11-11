import { describe, expect, it } from 'vitest';

import {
  climbLine,
  crownHolder,
  groupCodeFromUrl,
  groupInviteMessage,
  madeIt,
  myPodiumLine,
  podium,
  podiumSteps,
  podiumWeek,
  podiumWeekLabel,
  showPodium,
  squadLine,
  squadNeed,
} from './groups';

describe('squadNeed', () => {
  it('needs everyone in small groups and 80% in bigger ones', () => {
    expect([1, 2, 3, 4, 5, 10, 20].map(squadNeed)).toEqual([1, 2, 3, 4, 4, 8, 16]);
  });
});

describe('groupCodeFromUrl', () => {
  it('reads web and app links', () => {
    expect(groupCodeFromUrl('https://sigamos.cloud/group/ab12cd')).toBe('AB12CD');
    expect(groupCodeFromUrl('sigamos://group/join/AB12CD')).toBe('AB12CD');
  });
  it('ignores partner invites and broken codes', () => {
    expect(groupCodeFromUrl('https://sigamos.cloud/invite/AB12CD')).toBeNull();
    expect(groupCodeFromUrl('https://sigamos.cloud/group/AB1')).toBeNull();
  });
});

describe('groupInviteMessage', () => {
  it('includes the link and the code', () => {
    const text = groupInviteMessage({ name: 'Gym Rats', emoji: '🏋️', invite_code: 'AB12CD' });
    expect(text).toContain('🏋️ Gym Rats');
    expect(text).toContain('https://sigamos.cloud/group/AB12CD');
    expect(text).toContain('code in the app: AB12CD');
  });
});

describe('crownHolder', () => {
  it('crowns last week’s single top scorer', () => {
    expect(crownHolder([{ user_id: 'a', last_week_xp: 40 }, { user_id: 'b', last_week_xp: 90 }])).toBe('b');
  });
  it('crowns nobody on a tie or an empty week', () => {
    expect(crownHolder([{ user_id: 'a', last_week_xp: 50 }, { user_id: 'b', last_week_xp: 50 }])).toBeNull();
    expect(crownHolder([{ user_id: 'a', last_week_xp: 0 }])).toBeNull();
  });
});

describe('madeIt and squadLine', () => {
  it('counts a hit week or a reached goal', () => {
    expect(madeIt({ week_status: 'hit', this_week_days: 1, this_week_goal: 3 })).toBe(true);
    expect(madeIt({ week_status: 'in_progress', this_week_days: 3, this_week_goal: 3 })).toBe(true);
    expect(madeIt({ week_status: 'in_progress', this_week_days: 2, this_week_goal: 3 })).toBe(false);
  });
  it('says where the week stands', () => {
    expect(squadLine({ made: 4, need: 4, member_count: 4 })).toBe('Squad week made! 🔥');
    expect(squadLine({ made: 3, need: 4, member_count: 4 })).toBe('One more goal keeps the squad streak alive');
    expect(squadLine({ made: 1, need: 4, member_count: 4 })).toBe('3 more goals keep the squad streak alive');
    expect(squadLine({ made: 0, need: 1, member_count: 1 })).toBe('Invite people to start a squad streak');
  });
});

describe('podium', () => {
  const row = (name: string, last_week_xp: number, is_me = false) => ({ user_id: name, name, last_week_xp, is_me });

  it('matches the Sunday push: shared medals on ties, XP earners only', () => {
    const rows = [row('Drew', 100), row('Eli', 0), row('Blair', 300), row('Fay', 50), row('Alex', 300, true), row('Casey', 200)];
    expect(podium(rows).map((p) => [p.name, p.medal, p.xp])).toEqual([
      ['Alex', 0, 300],
      ['Blair', 0, 300],
      ['Casey', 1, 200],
      ['Drew', 2, 100],
    ]);
  });

  it('is empty when nobody earned XP, and short when few did', () => {
    expect(podium([row('A', 0), row('B', 0)])).toEqual([]);
    expect(podium([row('A', 40), row('B', 0)]).map((p) => p.name)).toEqual(['A']);
  });

  it('shows on Sunday and Monday only', () => {
    expect([8, 9, 10, 14].map((d) => showPodium(new Date(2026, 10, d)))).toEqual([true, true, false, false]);
  });
});

describe('medal ceremony', () => {
  const row = (name: string, last_week_xp: number, is_me = false) => ({ user_id: name, name, last_week_xp, is_me });
  const rows = [row('Alex', 300), row('Blair', 300), row('Casey', 200), row('Drew', 100), row('Fay', 50), row('Eli', 0)];
  const as = (name: string) => rows.map((r) => ({ ...r, is_me: r.name === name }));

  it('puts everyone on their step, ties together', () => {
    expect(podiumSteps(podium(rows)).map((s) => s.map((p) => p.name))).toEqual([['Alex', 'Blair'], ['Casey'], ['Drew']]);
    expect(podiumSteps(podium([row('A', 10), row('B', 0)])).map((s) => s.length)).toEqual([1, 0, 0]);
  });

  it('ends with your own line', () => {
    expect(myPodiumLine(as('Blair'))).toBe('You won gold! 🥇');
    expect(myPodiumLine(as('Casey'))).toBe('You took silver! 🥈');
    expect(myPodiumLine(as('Drew'))).toBe('You took bronze! 🥉');
    expect(myPodiumLine(as('Fay'))).toBe('You were 4th with 50 XP. Fresh week, let’s go 💪');
    expect(myPodiumLine(as('Eli'))).toBe('Fresh week, fresh start. Let’s go 💪');
  });

  it('is about the week that just ended', () => {
    expect(podiumWeek(new Date(2026, 10, 8, 9))).toBe('2026-11-01');
    expect(podiumWeek(new Date(2026, 10, 14, 23))).toBe('2026-11-01');
    expect(podiumWeekLabel(new Date(2026, 10, 9))).toBe('Nov 1 – 7');
    expect(podiumWeekLabel(new Date(2026, 10, 3))).toBe('Oct 25 – 31');
    expect(podiumWeekLabel(new Date(2026, 11, 2))).toBe('Nov 22 – 28');
    expect(podiumWeekLabel(new Date(2026, 11, 7))).toBe('Nov 29 – Dec 5');
  });
});

describe('climbLine', () => {
  const row = (name: string, xp: number, is_me = false) => ({ name, xp, is_me });

  it('shows the gap to the next person up', () => {
    expect(climbLine([row('Maria', 300), row('Sam', 200), row('Alex', 150, true)])).toBe('50 XP to pass Sam');
  });

  it('celebrates the lead and calls a tie', () => {
    expect(climbLine([row('Alex', 300, true), row('Maria', 215)])).toBe('You’re in the lead by 85 XP 🥇');
    expect(climbLine([row('Alex', 300, true), row('Maria', 300)])).toBe('You’re tied for first. One more workout breaks it.');
  });

  it('invites the first move on an empty board, and says nothing alone', () => {
    expect(climbLine([row('Alex', 0, true), row('Maria', 0)])).toBe(
      'Nobody’s on the board yet. Your first workout takes the lead.',
    );
    expect(climbLine([row('Alex', 40, true)])).toBeNull();
  });
});
