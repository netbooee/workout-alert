import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useSegments } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

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
import { mascotKind } from '@/lib/mascots';
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
    mascot: mascotKind(profile.mascot),
  });
}

const greetedKey = (userId: string) => `lotl:greeted:${userId}`;
const welcomedKey = (userId: string) => `welcome:seen:${userId}`;

/**
 * The first time someone opens the app it shows the welcome tour; after that,
 * your buddy's greeting the first time the app is opened each day (never both at once).
 */
export function useDailyGreeting() {
  const profile = useProfile();
  const { isSuccess } = useHomeData();
  // Only greet over the tabs, never on top of a screen someone opened on purpose
  // (logging a workout, or a notification that deep-linked somewhere).
  const segments = useSegments();
  const tabsShowing = segments[0] === '(tabs)';
  const onTabs = useRef(tabsShowing);
  useEffect(() => {
    onTabs.current = tabsShowing;
  }, [tabsShowing]);

  useEffect(() => {
    if (!isSuccess) return;
    let cancelled = false;
    let checking = false;

    const check = async () => {
      if (checking || !onTabs.current) return;
      checking = true;
      try {
        const today = dayKey(new Date());
        const [welcomed, greeted] = await Promise.all([
          AsyncStorage.getItem(welcomedKey(profile.id)),
          AsyncStorage.getItem(greetedKey(profile.id)),
        ]);
        if (cancelled || !onTabs.current) return;
        if (!welcomed) {
          await AsyncStorage.multiSet([
            [welcomedKey(profile.id), '1'],
            [greetedKey(profile.id), today],
          ]);
          router.push('/welcome');
          return;
        }
        if (greeted === today) return;
        await AsyncStorage.setItem(greetedKey(profile.id), today);
        router.push('/greeting');
      } finally {
        checking = false;
      }
    };

    check();
    // iOS usually resumes the app rather than relaunching it, so check again each
    // time it comes to the foreground: the first open of the day gets the greeting.
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [isSuccess, profile.id]);
}
