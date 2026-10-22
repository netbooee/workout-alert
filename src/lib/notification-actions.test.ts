import { describe, expect, it } from 'vitest';

import { reactionForAction, workoutIdFromUrl } from './notification-actions';

describe('reactionForAction', () => {
  it('maps the buttons to reactions', () => {
    expect(reactionForAction('cheer')).toBe('clap');
    expect(reactionForAction('verify')).toBe('verified');
  });

  it('does nothing for a plain tap', () => {
    expect(reactionForAction('expo.modules.notifications.actions.DEFAULT')).toBeNull();
  });
});

describe('workoutIdFromUrl', () => {
  it('reads the workout id', () => {
    expect(workoutIdFromUrl('/workout/0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(
      '0f8fad5b-d9cb-469f-a165-70867728950e',
    );
  });

  it('ignores other links', () => {
    expect(workoutIdFromUrl('/partners')).toBeNull();
    expect(workoutIdFromUrl('/workout/not-an-id')).toBeNull();
    expect(workoutIdFromUrl(undefined)).toBeNull();
  });
});
