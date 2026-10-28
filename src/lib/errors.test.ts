import { describe, expect, it } from 'vitest';

import { friendlyError } from './errors';

describe('friendlyError', () => {
  it('explains being offline', () => {
    expect(friendlyError(new TypeError('Network request failed'))).toMatch(/offline/);
  });

  it('keeps messages our database writes for people', () => {
    expect(friendlyError({ code: 'P0002', message: 'No one has that invite code' })).toBe('No one has that invite code');
    expect(friendlyError({ code: '22023', message: 'That is your own invite code' })).toBe('That is your own invite code');
  });

  it('never shows database jargon or [object Object]', () => {
    expect(friendlyError({ code: '42703', message: 'column "foo" does not exist' })).toMatch(/Something went wrong/);
    expect(friendlyError({})).toMatch(/Something went wrong/);
    expect(friendlyError({ code: 'PGRST301', message: 'JWT expired' })).toMatch(/sign-in has expired/);
  });

  it('maps common codes', () => {
    expect(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(
      'That’s already been done.',
    );
    expect(friendlyError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })).toMatch(
      /couldn’t find/,
    );
  });

  it('passes plain sentences through', () => {
    expect(friendlyError(new Error('Choose a reward first'))).toBe('Choose a reward first');
    expect(friendlyError('Photo is too large')).toBe('Photo is too large');
  });
});

describe('real messages from the app', () => {
  it('recognises iOS being offline through Expo', () => {
    const msg =
      'Error: fetch failed: UnexpectedException: The Internet connection appears to be offline. (at ExpoModulesCore/Promise.swift:56)';
    expect(friendlyError(new Error(msg))).toMatch(/offline/);
    expect(friendlyError({ message: msg })).toMatch(/offline/);
  });
});
