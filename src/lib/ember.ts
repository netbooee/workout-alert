// Ember, the streak mascot: decides its mood, what it says, and what it
// suggests you do. Pure (no React Native imports) so it's unit-testable and so
// a future home-screen widget can reuse the same rules and look.

import { dayKey, weekState } from '@/lib/week';

export type EmberMood = 'blazing' | 'happy' | 'ready' | 'worried' | 'fired_up' | 'sleepy';

/** How each mood looks. Shared by the in-app character and a future widget. */
export const EMBER_LOOKS: Record<
  EmberMood,
  { outer: string; inner: string; scale: number; label: string }
> = {
  blazing: { outer: '#FF8A1F', inner: '#FFD60A', scale: 1.12, label: 'Blazing' },
  happy: { outer: '#FF6B1A', inner: '#FFB02E', scale: 1, label: 'Happy' },
  ready: { outer: '#FF6B1A', inner: '#FFA23A', scale: 0.96, label: 'Ready' },
  worried: { outer: '#E4572E', inner: '#F7A35C', scale: 0.86, label: 'Worried' },
  fired_up: { outer: '#D62828', inner: '#FF6B1A', scale: 0.76, label: 'Fired up' },
  sleepy: { outer: '#6C7BD9', inner: '#AFC2FF', scale: 0.9, label: 'Resting' },
};

export interface EmberInput {
  now: Date;
  firstName?: string | null;
  streakWeeks: number;
  freezes: number;
  weekDays: number;
  weekGoal: number;
  /** null if there has never been a workout. */
  daysSinceLastWorkout: number | null;
  resting: boolean;
  nudgedBy?: string | null;
  verifiedBy?: string | null;
  partnerWorkedOutToday?: string | null;
  league?: { rank: number; size: number; gapToNext: number; aheadName?: string | null } | null;
  /** Downgrade "fired up" to "worried" once the day's greeting has been seen. */
  calm?: boolean;
}

export interface EmberFact {
  emoji: string;
  text: string;
}

export interface EmberMessage {
  mood: EmberMood;
  headline: string;
  facts: EmberFact[];
  action: { label: string; href: '/log' | '/partners' | null };
}

/** Days without a workout before Ember gets fired up. */
export const IDLE_DAYS = 4;

export function emberMood(i: EmberInput): EmberMood {
  if (i.resting) return 'sleepy';
  if (i.weekDays >= i.weekGoal) return 'blazing';

  const state = weekState(i.weekDays, i.weekGoal, i.now);
  const idle = i.daysSinceLastWorkout != null && i.daysSinceLastWorkout >= IDLE_DAYS;
  // Out of reach with no freeze means the streak is about to break. With a
  // freeze it's covered, so never get angry about it.
  const doomed = state.kind === 'out-of-reach' && i.streakWeeks > 0 && i.freezes === 0;

  let mood: EmberMood;
  if (idle || doomed) mood = 'fired_up';
  else if (state.kind === 'at-risk' || state.kind === 'out-of-reach') mood = 'worried';
  else if (i.weekDays === 0) mood = 'ready';
  else mood = 'happy';

  return i.calm && mood === 'fired_up' ? 'worried' : mood;
}

// ─── Lines ───────────────────────────────────────────────────────────────────
// Several variants per mood; one is picked per day so it doesn't repeat.

type Vars = { name: string; needed: number; left: number; idle: number; streak: number; goal: number };
type Line = (v: Vars) => string;

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
const workouts = (n: number) => `${n} workout${n === 1 ? '' : 's'}`;

const LINES: Record<EmberMood, Line[]> = {
  blazing: [
    (v) => `${v.goal} for ${v.goal}. You're unstoppable, ${v.name}. 🔥`,
    () => 'Week goal: crushed. I have never burned this bright.',
    (v) => (v.streak > 1 ? `${v.streak} weeks strong. Rest up, champ.` : 'Goal hit! Look at me glow.'),
  ],
  happy: [
    (v) => `${v.needed} to go and ${days(v.left)} to do it. Easy.`,
    (v) => `Nice work, ${v.name}. ${workouts(v.needed)} left this week.`,
    () => "We're cooking. Keep that fire fed. 🔥",
  ],
  ready: [
    () => "New week, clean slate. Let's get the first one in.",
    (v) => `Morning, ${v.name}! I'm warmed up. Are you?`,
    (v) => `${workouts(v.goal)} this week. First one's the hardest. Let's go.`,
  ],
  worried: [
    (v) => `${workouts(v.needed)}, ${days(v.left)}. I'm getting nervous here…`,
    (v) => `Psst, ${v.name}. We need ${workouts(v.needed)} and time's ticking. 😬`,
    (v) =>
      v.needed === v.left
        ? 'Every day counts now. No pressure. (Some pressure.)'
        : `Still doable! ${v.needed} more in ${days(v.left)}.`,
  ],
  fired_up: [
    (v) =>
      v.idle >= IDLE_DAYS
        ? `It's been ${days(v.idle)}. I'm literally going out. Move! 😤`
        : "This week's slipping and so am I. Do something!",
    (v) => `${v.name}. Shoes. On. Now. I believe in you (angrily).`,
    () => "I didn't flicker this hard to watch you sit there. Up! 😤",
  ],
  sleepy: [
    () => 'Resting up. Your streak is safe with me. 😴',
    (v) => `Get well, ${v.name}. I'll keep the embers warm.`,
    () => "Zzz… no pressure this week. Come back when you're ready.",
  ],
};

function pick<T>(items: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return items[Math.abs(h) % items.length]!;
}

const ORDINAL = ['1st', '2nd', '3rd'];

export function emberMessage(i: EmberInput): EmberMessage {
  const mood = emberMood(i);
  const state = weekState(i.weekDays, i.weekGoal, i.now);
  const vars: Vars = {
    name: i.firstName?.trim() || 'friend',
    needed: Math.max(i.weekGoal - i.weekDays, 0),
    left: state.kind === 'done' ? 0 : state.daysLeft,
    idle: i.daysSinceLastWorkout ?? 0,
    streak: i.streakWeeks,
    goal: i.weekGoal,
  };
  const headline = pick(LINES[mood], `${dayKey(i.now)}:${mood}`)(vars);

  const facts: EmberFact[] = [];
  facts.push(
    i.resting
      ? { emoji: '😴', text: `Rest mode on · ${i.streakWeeks}-week streak protected` }
      : {
          emoji: '🔥',
          text: `${i.streakWeeks}-week streak · ${i.weekDays}/${i.weekGoal} this week`,
        },
  );
  if (i.nudgedBy) facts.push({ emoji: '👋', text: `${i.nudgedBy} nudged you` });
  if (i.verifiedBy) facts.push({ emoji: '✅', text: `${i.verifiedBy} verified your workout` });
  if (facts.length < 3 && i.partnerWorkedOutToday && mood !== 'blazing' && mood !== 'sleepy') {
    facts.push({ emoji: '👀', text: `${i.partnerWorkedOutToday} already worked out today` });
  }
  if (facts.length < 3 && i.league && i.league.size > 1) {
    const place = ORDINAL[i.league.rank - 1] ?? `${i.league.rank}th`;
    facts.push(
      i.league.rank === 1
        ? { emoji: '🥇', text: 'You lead the league this week' }
        : {
            emoji: i.league.rank === 2 ? '🥈' : i.league.rank === 3 ? '🥉' : '🏅',
            text: `${place} in the league, ${i.league.gapToNext} XP behind ${i.league.aheadName ?? 'the next spot'}`,
          },
    );
  }

  let action: EmberMessage['action'];
  if (mood === 'blazing') action = { label: 'See the league', href: '/partners' };
  else if (mood === 'sleepy') action = { label: 'Rest easy', href: null };
  else if (i.nudgedBy) action = { label: 'Log a workout', href: '/log' };
  else if (mood === 'happy' && i.verifiedBy) action = { label: 'See partners', href: '/partners' };
  else action = { label: mood === 'happy' ? "Let's go" : 'Log a workout', href: mood === 'happy' ? null : '/log' };

  return { mood, headline, facts: facts.slice(0, 3), action };
}
