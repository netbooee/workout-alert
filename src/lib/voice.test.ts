import { describe, expect, it } from 'vitest';

import { formatClip } from './voice';

describe('formatClip', () => {
  it('formats milliseconds as m:ss', () => {
    expect(formatClip(0)).toBe('0:00');
    expect(formatClip(12400)).toBe('0:12');
    expect(formatClip(29600)).toBe('0:30');
    expect(formatClip(65000)).toBe('1:05');
  });

  it('never goes negative', () => {
    expect(formatClip(-500)).toBe('0:00');
  });
});
