import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { useHomeData } from '@/hooks/use-home-data';
import {
  useLeague,
  useNames,
  usePartnerFeed,
  useRecentVerifications,
  useUnseenNudges,
} from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import { lotlMessage, type LotlMessage } from '@/lib/lotl';
import { buildWeek, dayKey, startOfDay } from '@/lib/week';

const firstName = (name: string) => name.split(' ')[0] ?? name;

/**
 * Everything Lotl needs to know, gathered from data the app already loads.
 * `calm` softens "fired up" to "worried" (it's only allowed on the daily greeting).
 */
export function useLotl({ calm = true }: { calm?: boolean } = {}): LotlMessage | null {
  const profile = useProfile();
  const { data: home } = useHomeData();
  const { data: nudges } = useUnseenNudges();
  const { data: feed } = usePartnerFeed();
  const { data: league } = useLeague();
  const recentIds = useMemo(() => home?.recentWorkouts.map((w) => w.id) ?? [], [home]);
  const { data: verifications } = useRecentVerifications(recentIds);
  const nameOf = useNames();
  // Captured once per mount; the greeting is recomputed each time it opens.
  const [now] = useState(() => new Date());

  if (!home) return null;

  const weekDays = buildWeek(home.weekWorkouts, profile.min_workout_minutes, now).filter((d) => d.active).length;
  const last = home.recentWorkouts[0];
  const daysSinceLastWorkout = last
    ? Math.round((startOfDay(now).getTime() - startOfDay(new Date(last.started_at)).getTime()) / 86_400_000)
    : null;

  const today = dayKey(now);
  const partnerToday = feed?.find((f) => dayKey(new Date(f.workout.started_at)) === today);

  const meIndex = league?.findIndex((r) => r.is_me) ?? -1;
  const ahead = meIndex > 0 ? league![meIndex - 1] : null;

  return lotlMessage({
    now,
    firstName: profile.display_name ? firstName(profile.display_name) : null,
    streakWeeks: home.streak?.current_weeks ?? 0,
    freezes: home.streak?.freezes_banked ?? 0,
    weekDays,
    weekGoal: profile.weekly_goal,
    daysSinceLastWorkout,
    resting: !!profile.resting_since,
    nudgedBy: nudges?.[0] ? firstName(nameOf(nudges[0].from_id)) : null,
    verifiedBy: verifications?.[0] ? firstName(nameOf(verifications[0].user_id)) : null,
    partnerWorkedOutToday: partnerToday ? firstName(nameOf(partnerToday.workout.user_id)) : null,
    league:
      league && meIndex >= 0 && league.length > 1
        ? {
            rank: meIndex + 1,
            size: league.length,
            gapToNext: ahead ? ahead.xp - league[meIndex]!.xp : 0,
            aheadName: ahead?.display_name ? firstName(ahead.display_name) : null,
          }
        : null,
    calm,
  });
}

const greetedKey = (userId: string) => `lotl:greeted:${userId}`;

/** Opens Lotl's greeting the first time the app is opened each day. */
export function useDailyGreeting() {
  const profile = useProfile();
  const { isSuccess } = useHomeData();

  useEffect(() => {
    if (!isSuccess) return;
    let cancelled = false;
    (async () => {
      const today = dayKey(new Date());
      if ((await AsyncStorage.getItem(greetedKey(profile.id))) === today || cancelled) return;
      await AsyncStorage.setItem(greetedKey(profile.id), today);
      router.push('/greeting');
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuccess, profile.id]);
}
