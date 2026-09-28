// Lotl, the streak mascot (an axolotl): decides its mood, what it says, and
// what it suggests you do. Pure (no React Native imports) so it's unit-testable and so
// a future home-screen widget can reuse the same rules and look.

import { dayKey, weekState } from '@/lib/week';

export type LotlMood = 'blazing' | 'happy' | 'ready' | 'worried' | 'fired_up' | 'sleepy';

/**
 * How each mood looks: an axolotl whose color and gills show how it feels
 * (gills flare up when happy or fired up, droop when worried or sleepy).
 * Shared by the in-app character and a future home-screen widget.
 */
export const LOTL_LOOKS: Record<
  LotlMood,
  {
    body: string;
    belly: string;
    gills: string;
    /** Glow and speech-bubble color around Lotl. */
    accent: string;
    /** Degrees the gills tilt up (+) or droop (−). */
    gillLift: number;
    scale: number;
    label: string;
  }
> = {
  blazing: { body: '#FF8FB1', belly: '#FFD6E3', gills: '#FF4D7E', accent: '#FF6B9A', gillLift: 24, scale: 1.06, label: 'Blazing' },
  happy: { body: '#FFA3C2', belly: '#FFE2EC', gills: '#FF6F9B', accent: '#FF8FB1', gillLift: 10, scale: 1, label: 'Happy' },
  ready: { body: '#FFB3CB', belly: '#FFE8F0', gills: '#FF85A8', accent: '#FF9CBB', gillLift: 0, scale: 0.98, label: 'Ready' },
  worried: { body: '#F2B8C9', belly: '#FBE5EC', gills: '#DE8CA5', accent: '#E58AA6', gillLift: -20, scale: 0.94, label: 'Worried' },
  fired_up: { body: '#FF7F7F', belly: '#FFCFC7', gills: '#E03131', accent: '#E03131', gillLift: 32, scale: 0.97, label: 'Fired up' },
  sleepy: { body: '#BDB8F2', belly: '#E6E3FF', gills: '#8C86E2', accent: '#8B96E9', gillLift: -30, scale: 0.94, label: 'Resting' },
};

export interface LotlInput {
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

export interface LotlFact {
  emoji: string;
  text: string;
}

export interface LotlMessage {
  mood: LotlMood;
  headline: string;
  facts: LotlFact[];
  action: { label: string; href: '/log' | '/partners' | null };
}

/** Days without a workout before Lotl gets fired up. */
export const IDLE_DAYS = 4;

export function lotlMood(i: LotlInput): LotlMood {
  if (i.resting) return 'sleepy';
  if (i.weekDays >= i.weekGoal) return 'blazing';

  const state = weekState(i.weekDays, i.weekGoal, i.now);
  const idle = i.daysSinceLastWorkout != null && i.daysSinceLastWorkout >= IDLE_DAYS;
  // Out of reach with no freeze means the streak is about to break. With a
  // freeze it's covered, so never get angry about it.
  const doomed = state.kind === 'out-of-reach' && i.streakWeeks > 0 && i.freezes === 0;

  let mood: LotlMood;
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

const LINES: Record<LotlMood, Line[]> = {
  blazing: [
    (v) => `${v.goal} for ${v.goal}. You're unstoppable, ${v.name}. 🔥`,
    () => 'Week goal: crushed. My gills are doing a happy dance.',
    (v) => (v.streak > 1 ? `${v.streak} weeks strong. Rest up, champ.` : 'Goal hit! Look at me wiggle.'),
  ],
  happy: [
    (v) => `${v.needed} to go and ${days(v.left)} to do it. Easy.`,
    (v) => `Nice work, ${v.name}. ${workouts(v.needed)} left this week.`,
    () => "We're cooking. Keep those fins moving. 🔥",
  ],
  ready: [
    () => "New week, clean slate. Let's get the first one in.",
    (v) => `Morning, ${v.name}! Gills fluffed, ready to go. Are you?`,
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
        ? `It's been ${days(v.idle)}. I'm literally drying out here. Move! 😤`
        : "This week's slipping and my gills are shaking. Do something!",
    (v) => `${v.name}. Shoes. On. Now. I believe in you (angrily).`,
    () => "I didn't regrow a whole leg to watch you sit there. Up! 😤",
  ],
  sleepy: [
    () => 'Resting up. Your streak is safe with me. 😴',
    (v) => `Get well, ${v.name}. I'll keep the water warm.`,
    () => "Zzz… no pressure this week. Come back when you're ready.",
  ],
};

function pick<T>(items: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return items[Math.abs(h) % items.length]!;
}

const ORDINAL = ['1st', '2nd', '3rd'];

export function lotlMessage(i: LotlInput): LotlMessage {
  const mood = lotlMood(i);
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

  const facts: LotlFact[] = [];
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

  let action: LotlMessage['action'];
  if (mood === 'blazing') action = { label: 'See the league', href: '/partners' };
  else if (mood === 'sleepy') action = { label: 'Rest easy', href: null };
  else if (i.nudgedBy) action = { label: 'Log a workout', href: '/log' };
  else if (mood === 'happy' && i.verifiedBy) action = { label: 'See partners', href: '/partners' };
  else action = { label: mood === 'happy' ? "Let's go" : 'Log a workout', href: mood === 'happy' ? null : '/log' };

  return { mood, headline, facts: facts.slice(0, 3), action };
}
