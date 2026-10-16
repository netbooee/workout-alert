// What the home-screen and Lock Screen widget shows, and when. The widget can't load
// data itself, so the app hands it a timeline: what to show now, and how the message
// should change through the rest of the week if no new workout comes in (gentle in the
// morning, firmer in the afternoon, urgent in the evening when today counts).
// Pure (no React Native imports) so it's unit-testable.

import { lotlMood, type LotlMood } from '@/lib/lotl';
import type { MascotKind } from '@/lib/mascots';
import { addDays, dayKey, startOfDay, startOfWeek } from '@/lib/week';

export type WidgetDot = 'done' | 'today' | 'missed' | 'future';
export type WidgetIcon = 'bell' | 'gift' | 'person' | 'eyes' | 'trophy';

export interface WidgetReminder {
  icon: WidgetIcon;
  /** With names, for the home screen. */
  text: string;
  /** Without names, for the Lock Screen (anyone holding the phone can see it). */
  privateText: string;
  url: string;
}

/** Everything the widget draws. Plain JSON: it crosses into the widget's own runtime. */
export interface WidgetProps {
  mascot: MascotKind;
  mood: LotlMood;
  /** file:// URI of the character picture in the shared App Group folder, if copied. */
  image: string | null;
  /** Null right after the week rolls over, until the app syncs the new streak. */
  streak: number | null;
  headline: string;
  detail: string;
  /** Last chance: draw the headline in the accent color. */
  urgent: boolean;
  dots: WidgetDot[];
  weekDays: number;
  weekGoal: number;
  resting: boolean;
  reminder: WidgetReminder | null;
  url: string;
}

export interface WidgetEntry {
  date: Date;
  props: WidgetProps;
}

export interface WidgetInput {
  now: Date;
  mascot: MascotKind;
  /** Shared folder holding `<mascot>-<mood>.png`, or null if pictures aren't available. */
  imageDir: string | null;
  streakWeeks: number;
  freezes: number;
  weekGoal: number;
  minWorkoutMinutes: number;
  /** Local day keys (YYYY-MM-DD) this week with a qualifying workout. */
  workoutDays: readonly string[];
  /** Start time of the most recent workout, if any. */
  lastWorkoutAt: Date | null;
  resting: boolean;
  partnerRequestFrom?: string | null;
  incentiveOffer?: { id: string; from: string; reward: string } | null;
  /** An accepted incentive you're close to earning; `left` is e.g. "1 workout day". */
  incentiveClose?: { id: string; from: string; reward: string; left: string } | null;
  nudgedBy?: string | null;
  partnerWorkedOutToday?: string | null;
  league?: { rank: number; gapToNext: number; aheadName?: string | null } | null;
}

const HOME_URL = 'sigamos:///';
/** Times of day the widget's tone steps up when today still needs a workout. */
const CHECKPOINTS = [6, 13, 18];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The widget's timeline: now, then each checkpoint through Sunday, then Monday 00:00. */
export function widgetTimeline(i: WidgetInput): WidgetEntry[] {
  const monday = startOfWeek(i.now);
  const nextMonday = addDays(monday, 7);
  const dates = [i.now];
  for (let d = startOfDay(i.now); d < nextMonday; d = addDays(d, 1)) {
    for (const h of CHECKPOINTS) {
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h);
      if (t > i.now) dates.push(t);
    }
  }
  dates.push(nextMonday);
  return dates.map((date) => ({ date, props: widgetProps(i, date) }));
}

/** What the widget should show at `at`, assuming no new workouts since `i.now`. */
export function widgetProps(i: WidgetInput, at: Date): WidgetProps {
  const sameDay = dayKey(at) === dayKey(i.now);
  const newWeek = startOfWeek(at).getTime() !== startOfWeek(i.now).getTime();
  const done = new Set(newWeek ? [] : i.workoutDays);
  const monday = startOfWeek(at);
  const todayIndex = (at.getDay() + 6) % 7;
  const dots: WidgetDot[] = Array.from({ length: 7 }, (_, d) => {
    if (done.has(dayKey(addDays(monday, d)))) return 'done';
    if (d === todayIndex) return 'today';
    return d < todayIndex ? 'missed' : 'future';
  });

  const weekDays = done.size;
  const needed = Math.max(i.weekGoal - weekDays, 0);
  const doneToday = done.has(dayKey(at));
  // Days still available to work out, today included unless it's already done.
  const available = 7 - todayIndex - (doneToday ? 1 : 0);
  const lastChance = needed > 0 && !doneToday && needed === available;
  const hour = at.getHours();

  const daysSinceLastWorkout = i.lastWorkoutAt
    ? Math.round((startOfDay(at).getTime() - startOfDay(i.lastWorkoutAt).getTime()) / 86_400_000)
    : null;
  let mood = lotlMood({
    now: at,
    streakWeeks: i.streakWeeks,
    freezes: i.freezes,
    weekDays,
    weekGoal: i.weekGoal,
    daysSinceLastWorkout,
    resting: i.resting,
    calm: true,
  });
  // The one time the widget gets fired up: the evening when today still has to count.
  if (!i.resting && lastChance && hour >= 18) mood = 'fired_up';

  const streak = newWeek ? null : i.streakWeeks;
  const keep = streak ? ` to keep ${plural(streak, 'week')}` : '';
  let headline: string;
  let detail: string;
  let urgent = false;

  if (i.resting) {
    headline = 'Resting';
    detail = 'Streak paused. Feel better!';
  } else if (newWeek) {
    headline = 'New week!';
    detail = 'Open Sigamos to start fresh';
  } else if (needed === 0) {
    headline = 'Week crushed!';
    detail = streak ? 'Streak safe this week' : 'Goal hit. Nice work!';
  } else if (needed > available) {
    headline = "Week's out of reach";
    detail = i.freezes > 0 ? 'A freeze will cover it' : 'Next week is a fresh start';
  } else if (doneToday) {
    headline = 'Done for today!';
    detail = `${needed} more by Sunday`;
  } else if (lastChance) {
    urgent = hour >= 18;
    if (needed === 1 && todayIndex === 6) {
      headline = 'Last chance!';
      detail = `One today${keep || ' hits your goal'}`;
    } else if (hour >= 18) {
      headline = "Tonight's the night";
      detail = streak ? `Go now, keep ${plural(streak, 'week')}` : 'Go now, you’ve got this';
    } else if (hour >= 13) {
      headline = 'Still time today';
      detail = `Even ${i.minWorkoutMinutes} minutes counts`;
    } else {
      headline = 'Today counts';
      detail = needed === 1 ? 'One workout does it' : `${needed} more: today + ${needed === 2 ? 'tomorrow' : 'every day left'}`;
    }
  } else if (weekDays === 0 && todayIndex === 0) {
    headline = 'Fresh week!';
    detail = `${plural(i.weekGoal, 'day')} to go`;
  } else if (needed >= available - 1) {
    headline = `${plural(needed, 'more day')}`;
    detail = `by Sunday${keep}`;
  } else {
    headline = `${weekDays} of ${i.weekGoal} days`;
    detail = needed === 1 ? 'Nice pace. One to go.' : `Nice pace. ${needed} to go.`;
  }

  const reminder = widgetReminder(i, { sameDay, newWeek, finished: needed === 0 });
  return {
    mascot: i.mascot,
    mood,
    image: i.imageDir ? `${i.imageDir.replace(/\/$/, '')}/${i.mascot}-${mood}.png` : null,
    streak,
    headline,
    detail,
    urgent,
    dots,
    weekDays,
    weekGoal: i.weekGoal,
    resting: i.resting,
    reminder,
    url: reminder?.url ?? HOME_URL,
  };
}

/** The one reminder worth a line, most important first. */
function widgetReminder(
  i: WidgetInput,
  at: { sameDay: boolean; newWeek: boolean; finished: boolean },
): WidgetReminder | null {
  if (i.partnerRequestFrom) {
    return {
      icon: 'person',
      text: `${i.partnerRequestFrom} wants to be partners`,
      privateText: 'A partner request is waiting',
      url: 'sigamos:///partners',
    };
  }
  if (i.incentiveOffer) {
    return {
      icon: 'gift',
      text: `${i.incentiveOffer.from} offered: ${i.incentiveOffer.reward}`,
      privateText: 'An incentive offer is waiting',
      url: `sigamos:///incentive/${i.incentiveOffer.id}`,
    };
  }
  if (i.resting || at.newWeek) return null;
  if (i.nudgedBy && at.sameDay && !at.finished) {
    return { icon: 'bell', text: `${i.nudgedBy} nudged you`, privateText: 'A partner nudged you', url: 'sigamos:///log' };
  }
  if (i.incentiveClose) {
    return {
      icon: 'gift',
      text: `${i.incentiveClose.left} from ${i.incentiveClose.from}'s ${i.incentiveClose.reward}`,
      privateText: `${i.incentiveClose.left} from a reward`,
      url: `sigamos:///incentive/${i.incentiveClose.id}`,
    };
  }
  if (i.partnerWorkedOutToday && at.sameDay && !at.finished) {
    return {
      icon: 'eyes',
      text: `${i.partnerWorkedOutToday} already worked out today`,
      privateText: 'A partner worked out today',
      url: 'sigamos:///partners',
    };
  }
  if (i.league && i.league.rank > 0) {
    const behind =
      i.league.rank > 1 && i.league.aheadName ? ` · ${i.league.gapToNext} XP behind ${i.league.aheadName}` : '';
    return {
      icon: 'trophy',
      text: i.league.rank === 1 ? 'You lead your league this week' : `#${i.league.rank} in your league${behind}`,
      privateText: i.league.rank === 1 ? 'You lead your league' : `#${i.league.rank} in your league`,
      url: 'sigamos:///partners',
    };
  }
  return null;
}

/** What the widget shows after signing out: no streak, no names. */
export function signedOutWidget(): WidgetProps {
  return {
    mascot: 'lotl',
    mood: 'ready',
    image: null,
    streak: null,
    headline: 'Sigamos',
    detail: 'Sign in to see your streak',
    urgent: false,
    dots: Array(7).fill('future'),
    weekDays: 0,
    weekGoal: 1,
    resting: false,
    reminder: null,
    url: HOME_URL,
  };
}

/**
 * The widget's data is stored in the shared App Group's UserDefaults, which can't hold
 * null (iOS refuses the whole timeline and the widget renders blank). Drop null fields,
 * deeply; the widget treats a missing field the same as null.
 */
export function toWidgetPayload<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, v) => (v === null ? undefined : v))) as T;
}
