import { describe, expect, it } from 'vitest';

import { clampMinutes, logWindow, minutesLabel } from './log-workout';

describe('clampMinutes', () => {
  it('keeps durations between 5 minutes and 5 hours', () => {
    expect(clampMinutes(0)).toBe(5);
    expect(clampMinutes(47)).toBe(47);
    expect(clampMinutes(400)).toBe(300);
  });
});

describe('logWindow', () => {
  const now = new Date(2026, 9, 22, 12, 0);

  it('ends when you finished and starts the duration before', () => {
    const finished = new Date(2026, 9, 21, 18, 30);
    const { started, ended } = logWindow(finished, 45, now);
    expect(ended).toEqual(finished);
    expect(started).toEqual(new Date(2026, 9, 21, 17, 45));
  });

  it('never ends in the future', () => {
    expect(logWindow(new Date(2026, 9, 22, 15, 0), 30, now).ended).toEqual(now);
  });
});

describe('minutesLabel', () => {
  it('reads naturally', () => {
    expect(minutesLabel(45)).toBe('45 min');
    expect(minutesLabel(60)).toBe('1 h');
    expect(minutesLabel(90)).toBe('1 h 30 min');
  });
});
