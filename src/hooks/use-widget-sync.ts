import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useHomeData } from '@/hooks/use-home-data';
import { useMyIncentives } from '@/hooks/use-incentives';
import { useLeague, useNames, usePartnerFeed, usePartners, useUnseenNudges } from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import { isOpen } from '@/lib/incentives';
import { mascotKind } from '@/lib/mascots';
import { dayKey } from '@/lib/week';
import { updateWidget } from '@/widgets/sync';

const firstName = (name: string) => name.split(' ')[0] ?? name;

/** "1 workout day", "20 min", … for how much is left on an incentive. */
function leftText(kind: string, n: number): string {
  if (kind === 'active_minutes') return `${n} min`;
  const noun = kind === 'workout_days' ? 'workout day' : kind === 'workouts' ? 'workout' : 'week';
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * Keeps the home-screen widget in step with the app: whenever your week, partners,
 * incentives, or chosen character change, and whenever the app comes back to the
 * foreground, it hands the widget a fresh timeline.
 */
export function useWidgetSync() {
  const profile = useProfile();
  const { data: home } = useHomeData();
  const { data: partners } = usePartners();
  const { data: nudges } = useUnseenNudges();
  const { data: feed } = usePartnerFeed();
  const { data: league } = useLeague();
  const { received } = useMyIncentives();
  const nameOf = useNames();
  // Bumped when the app returns to the foreground so "today" and the checkpoints move on.
  const [wake, setWake] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setWake((n) => n + 1));
    return () => sub.remove();
  }, []);

  // Everything the widget depends on, flattened so the effect only reruns on real changes.
  // The clock is read inside the effect, never during render.
  const workoutDays = home
    ? [
        ...new Set(
          home.weekWorkouts
            .filter((w) => w.duration_s >= profile.min_workout_minutes * 60)
            .map((w) => dayKey(new Date(w.started_at))),
        ),
      ]
    : null;
  const request = partners?.find((p) => p.status === 'pending' && p.incoming);
  const offer = received.find((i) => i.status === 'offered');
  const close = received
    .filter((i) => isOpen(i) && i.status === 'active')
    .map((i) => ({ i, left: i.goal_target - i.progress }))
    .filter(({ i, left }) => left > 0 && (left <= 1 || i.progress / i.goal_target >= 0.75))
    .sort((a, b) => a.left / a.i.goal_target - b.left / b.i.goal_target)[0];
  const partnerDays = (feed ?? []).slice(0, 20).map((f) => ({
    day: dayKey(new Date(f.workout.started_at)),
    name: firstName(nameOf(f.workout.user_id)),
  }));
  const meIndex = league?.findIndex((r) => r.is_me) ?? -1;
  const ahead = meIndex > 0 ? league![meIndex - 1] : null;

  const input = workoutDays && {
    mascot: mascotKind(profile.mascot),
    streakWeeks: home!.streak?.current_weeks ?? 0,
    freezes: home!.streak?.freezes_banked ?? 0,
    weekGoal: profile.weekly_goal,
    minWorkoutMinutes: profile.min_workout_minutes,
    workoutDays,
    lastWorkoutAt: home!.recentWorkouts[0]?.started_at ?? null,
    resting: !!profile.resting_since,
    partnerRequestFrom: request ? firstName(request.display_name ?? 'Someone') : null,
    incentiveOffer: offer
      ? { id: offer.id, from: firstName(nameOf(offer.from_id)), reward: `${offer.reward_emoji} ${offer.reward}` }
      : null,
    incentiveClose: close
      ? {
          id: close.i.id,
          from: firstName(nameOf(close.i.from_id)),
          reward: close.i.reward,
          left: leftText(close.i.goal_kind, close.left),
        }
      : null,
    nudgedBy: nudges?.[0] ? firstName(nameOf(nudges[0].from_id)) : null,
    league:
      league && meIndex >= 0 && league.length > 1
        ? {
            rank: meIndex + 1,
            gapToNext: ahead ? ahead.xp - league[meIndex]!.xp : 0,
            aheadName: ahead?.display_name ? firstName(ahead.display_name) : null,
          }
        : null,
  };
  const signature = input ? JSON.stringify({ input, partnerDays, wake }) : null;

  useEffect(() => {
    if (!signature) return;
    const { input: latest, partnerDays: days } = JSON.parse(signature) as {
      input: NonNullable<typeof input>;
      partnerDays: typeof partnerDays;
    };
    const now = new Date();
    void updateWidget({
      ...latest,
      now,
      lastWorkoutAt: latest.lastWorkoutAt ? new Date(latest.lastWorkoutAt) : null,
      partnerWorkedOutToday: days.find((d) => d.day === dayKey(now))?.name ?? null,
    });
  }, [signature]);
}
