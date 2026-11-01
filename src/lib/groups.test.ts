import { describe, expect, it } from 'vitest';

import { crownHolder, groupCodeFromUrl, groupInviteMessage, madeIt, squadLine, squadNeed } from './groups';

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
