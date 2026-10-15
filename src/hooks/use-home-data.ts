import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { addDays, dayKey, startOfWeek } from '@/lib/week';

// Everything under the ['home'] key is invalidated after each health sync.
// Partners can read each other's workouts and streak weeks, so every query
// here filters to the signed-in user explicitly rather than relying on RLS.

export function useHomeData() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['home', 'summary', userId],
    enabled: !!userId,
    queryFn: async () => {
      const now = new Date();
      const [streak, weekWorkouts, recent, today] = await Promise.all([
        // Recomputes server-side so a lapsed week is reflected immediately.
        supabase.rpc('refresh_my_streak'),
        supabase
          .from('workouts')
          .select('*')
          .eq('user_id', userId!)
          .is('duplicate_of', null)
          .gte('started_at', startOfWeek(now).toISOString())
          .order('started_at', { ascending: false }),
        supabase
          .from('workouts')
          .select('*')
          .eq('user_id', userId!)
          .is('duplicate_of', null)
          .order('started_at', { ascending: false })
          .limit(10),
        supabase
          .from('daily_activity')
          .select('*')
          .eq('user_id', userId!)
          .eq('day', dayKey(now))
          .maybeSingle(),
      ]);
      for (const r of [streak, weekWorkouts, recent, today]) {
        if (r.error) throw r.error;
      }
      return {
        streak: streak.data,
        weekWorkouts: weekWorkouts.data ?? [],
        recentWorkouts: recent.data ?? [],
        today: today.data,
      };
    },
  });
}

export function useStreakHistory(weeks = 12) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['home', 'history', userId, weeks],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streak_weeks')
        .select('*')
        .eq('user_id', userId!)
        .order('week_start', { ascending: false })
        .limit(weeks);
      if (error) throw error;
      return data.reverse();
    },
  });
}

/** Workouts over the last year: enough for every Progress chart range, so switching ranges is instant. */
export function useProgressWorkouts() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['home', 'progress', userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = addDays(startOfWeek(new Date()), -7 * 51);
      const { data, error } = await supabase
        .from('workouts')
        .select('started_at, duration_s')
        .eq('user_id', userId!)
        .is('duplicate_of', null)
        .gte('started_at', since.toISOString());
      if (error) throw error;
      return data;
    },
  });
}

/** One week's workouts and streak status. `weekStart` is the Monday, YYYY-MM-DD. */
export function useWeekDetail(weekStart: string) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['home', 'week', userId, weekStart],
    enabled: !!userId,
    queryFn: async () => {
      const [y, m, d] = weekStart.split('-').map(Number) as [number, number, number];
      const start = new Date(y, m - 1, d);
      const [workouts, week] = await Promise.all([
        supabase
          .from('workouts')
          .select('*')
          .eq('user_id', userId!)
          .is('duplicate_of', null)
          .gte('started_at', start.toISOString())
          .lt('started_at', addDays(start, 7).toISOString())
          .order('started_at'),
        supabase
          .from('streak_weeks')
          .select('*')
          .eq('user_id', userId!)
          .eq('week_start', weekStart)
          .maybeSingle(),
      ]);
      if (workouts.error) throw workouts.error;
      if (week.error) throw week.error;
      return { start, workouts: workouts.data ?? [], week: week.data };
    },
  });
}
