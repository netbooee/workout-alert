import { describe, expect, it } from 'vitest';

import { signedOutWidget, toWidgetPayload, widgetProps, widgetTimeline, type WidgetInput } from './widget';

// Week of Sun 2026-10-11 … Sat 2026-10-17; `day` counts from Sunday.
const at = (day: number, hour: number) => new Date(2026, 9, 11 + day, hour);

const base: WidgetInput = {
  now: at(3, 9), // Wednesday morning
  mascot: 'capybara',
  imageDir: 'file:///group/widgets/',
  streakWeeks: 6,
  freezes: 0,
  weekGoal: 4,
  minWorkoutMinutes: 15,
  workoutDays: ['2026-10-11', '2026-10-13'], // Sun, Tue
  lastWorkoutAt: at(2, 7),
  resting: false,
};

describe('widgetProps', () => {
  it('shows the week as dots: done, missed, today, and still to come', () => {
    expect(widgetProps(base, base.now).dots).toEqual(['done', 'missed', 'done', 'today', 'future', 'future', 'future']);
  });

  it('counts down when the streak is at risk', () => {
    const p = widgetProps({ ...base, now: at(4, 9) }, at(4, 9)); // Thursday: 2 needed, 3 days left
    expect(p).toMatchObject({ headline: '2 more days', detail: 'by Saturday to keep 6 weeks', mood: 'worried' });
  });

  it('cheers when on pace', () => {
    const p = widgetProps({ ...base, workoutDays: [...base.workoutDays, '2026-10-12'] }, base.now);
    expect(p).toMatchObject({ headline: '3 of 4 days', detail: 'Nice pace. One to go.', mood: 'happy' });
  });

  it('gets more urgent through a day that has to count, and only fires up in the evening', () => {
    const fri = { ...base, now: at(5, 7) }; // Friday: 2 needed, Fri + Sat left
    expect(widgetProps(fri, at(5, 8))).toMatchObject({ headline: 'Today counts', urgent: false, mood: 'worried' });
    expect(widgetProps(fri, at(5, 14))).toMatchObject({ headline: 'Still time today', detail: 'Even 15 minutes counts' });
    expect(widgetProps(fri, at(5, 19))).toMatchObject({ headline: "Tonight's the night", urgent: true, mood: 'fired_up' });
  });

  it('calls Saturday with one to go the last chance', () => {
    const sat = { ...base, now: at(6, 9), workoutDays: [...base.workoutDays, '2026-10-15'] };
    expect(widgetProps(sat, at(6, 9))).toMatchObject({ headline: 'Last chance!', detail: 'One today to keep 6 weeks' });
  });

  it('calms down once today is done', () => {
    const fri = { ...base, now: at(5, 19), workoutDays: [...base.workoutDays, '2026-10-16'] };
    expect(widgetProps(fri, fri.now)).toMatchObject({ headline: 'Done for today!', detail: '1 more by Saturday', urgent: false });
  });

  it('celebrates a finished week with the blazing picture of the chosen character', () => {
    const p = widgetProps({ ...base, weekGoal: 2 }, base.now);
    expect(p).toMatchObject({ headline: 'Week crushed!', mood: 'blazing', image: 'file:///group/widgets/capybara-blazing.png' });
  });

  it('sleeps in rest mode and hides partner chatter', () => {
    const p = widgetProps({ ...base, resting: true, nudgedBy: 'Sam' }, base.now);
    expect(p).toMatchObject({ headline: 'Resting', mood: 'sleepy', reminder: null });
  });

  it('owns up when the week is out of reach, and mentions a freeze', () => {
    const p = widgetProps({ ...base, now: at(6, 9), freezes: 1 }, at(6, 9));
    expect(p).toMatchObject({ headline: "Week's out of reach", detail: 'A freeze will cover it' });
  });

  it('keeps names off the Lock Screen version of a reminder', () => {
    const r = widgetProps({ ...base, nudgedBy: 'Sam' }, base.now).reminder;
    expect(r).toEqual({ icon: 'bell', text: 'Sam nudged you', privateText: 'A partner nudged you', url: 'sigamos:///log' });
  });

  it('puts things waiting on you first and links the widget to them', () => {
    const p = widgetProps(
      { ...base, nudgedBy: 'Sam', incentiveOffer: { id: 'i1', from: 'Priya', reward: '🍽️ Dinner on me' } },
      base.now,
    );
    expect(p.reminder?.text).toBe('Priya offered: 🍽️ Dinner on me');
    expect(p.url).toBe('sigamos:///incentive/i1');
  });

  it('only mentions today’s nudges and partner workouts on the same day', () => {
    const i = { ...base, nudgedBy: 'Sam', partnerWorkedOutToday: 'Priya' };
    expect(widgetProps(i, base.now).reminder?.icon).toBe('bell');
    expect(widgetProps(i, at(4, 9)).reminder).toBeNull();
  });

  it('mentions an incentive you are close to earning, without names on the Lock Screen', () => {
    const r = widgetProps(
      { ...base, incentiveClose: { id: 'i2', from: 'Sam', reward: 'coffee', left: '1 workout day' } },
      base.now,
    ).reminder;
    expect(r).toMatchObject({ text: "1 workout day from Sam's coffee", privateText: '1 workout day from a reward' });
  });

  it('forgets your streak and partners after signing out', () => {
    expect(signedOutWidget()).toMatchObject({ streak: null, reminder: null, image: null });
  });

  it('shows no pictures when the shared folder is unavailable', () => {
    expect(widgetProps({ ...base, imageDir: null }, base.now).image).toBeNull();
  });
});

describe('widgetTimeline', () => {
  it('starts now, steps through each remaining checkpoint, and ends at the new week', () => {
    const t = widgetTimeline(base);
    expect(t[0]!.date).toEqual(base.now);
    // Wed 13:00 and 18:00, then 3 checkpoints each for Thu, Fri, Sat, then Sunday.
    expect(t).toHaveLength(1 + 2 + 9 + 1);
    expect(t.map((e) => e.date.getTime())).toEqual([...t.map((e) => e.date.getTime())].sort((a, b) => a - b));
    const last = t.at(-1)!;
    expect(last.date).toEqual(new Date(2026, 9, 18));
    expect(last.props).toMatchObject({ headline: 'New week!', streak: null, dots: Array(7).fill('future').fill('today', 0, 1) });
  });

  it('assumes no new workouts, so a quiet week gets more worried as days pass', () => {
    const moods = widgetTimeline(base).map((e) => e.props.mood);
    expect(moods[0]).toBe('happy');
    expect(moods).toContain('worried');
  });
});

describe('toWidgetPayload', () => {
  it('drops nulls everywhere, since the widget\'s storage cannot hold them', () => {
    const payload = toWidgetPayload(widgetTimeline(base).at(-1)!.props);
    expect(JSON.stringify(payload)).not.toContain('null');
    expect(payload).not.toHaveProperty('streak');
    expect(payload).not.toHaveProperty('reminder');
    expect(payload.headline).toBe('New week!');
    expect(toWidgetPayload({ a: { b: null, c: [1, null] } })).toEqual({ a: { c: [1, null] } });
  });
});

