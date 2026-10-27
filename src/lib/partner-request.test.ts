import { describe, expect, it } from 'vitest';

import { requestOutcome } from './partner-request';

const now = new Date('2026-10-22T12:00:00Z');
const justNow = '2026-10-22T11:59:50Z';
const lastWeek = '2026-10-15T12:00:00Z';

describe('requestOutcome', () => {
  it('celebrates a new partnership', () => {
    expect(requestOutcome({ status: 'accepted', requester_id: 'b', created_at: lastWeek, accepted_at: justNow }, 'a', now).title).toBe(
      'You’re partners! 🤝',
    );
  });

  it('says when you were already partners', () => {
    expect(requestOutcome({ status: 'accepted', requester_id: 'a', created_at: lastWeek, accepted_at: lastWeek }, 'a', now).title).toBe(
      'You’re already partners 🤝',
    );
  });

  it('tells a new request from a repeated one', () => {
    expect(requestOutcome({ status: 'pending', requester_id: 'a', created_at: justNow, accepted_at: null }, 'a', now).title).toBe(
      'Request sent',
    );
    expect(requestOutcome({ status: 'pending', requester_id: 'a', created_at: lastWeek, accepted_at: null }, 'a', now).title).toBe(
      'Request already sent',
    );
  });
});
