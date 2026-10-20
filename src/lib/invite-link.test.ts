import { describe, expect, it } from 'vitest';

import { inviteCodeFromUrl, inviteMessage, normalizeInviteCode } from './invite-link';

describe('normalizeInviteCode', () => {
  it('uppercases and strips spaces and dashes', () => {
    expect(normalizeInviteCode(' ab-12 cd ')).toBe('AB12CD');
  });

  it('rejects codes of the wrong length', () => {
    expect(normalizeInviteCode('AB12C')).toBeNull();
    expect(normalizeInviteCode('AB12CDE')).toBeNull();
  });
});

describe('inviteCodeFromUrl', () => {
  it('reads the app scheme', () => {
    expect(inviteCodeFromUrl('sigamos://invite/ab12cd')).toBe('AB12CD');
  });

  it('reads the website link, with or without www', () => {
    expect(inviteCodeFromUrl('https://sigamos.cloud/invite/AB12CD')).toBe('AB12CD');
    expect(inviteCodeFromUrl('https://www.sigamos.cloud/invite/AB12CD?ref=x')).toBe('AB12CD');
  });

  it('ignores other links', () => {
    expect(inviteCodeFromUrl('sigamos://workout/123')).toBeNull();
    expect(inviteCodeFromUrl('https://example.com/invite/AB12CD')).toBeNull();
    expect(inviteCodeFromUrl('sigamos://invite/')).toBeNull();
  });
});

describe('inviteMessage', () => {
  it('shares the web link and the code', () => {
    const message = inviteMessage('AB12CD');
    expect(message).toContain('https://sigamos.cloud/invite/AB12CD');
    expect(message).toContain('AB12CD');
  });
});
