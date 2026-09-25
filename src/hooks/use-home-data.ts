import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { dayKey, startOfWeek } from '@/lib/week';

// Everything under the ['home'] key is invalidated after each health sync.

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
          .gte('started_at', startOfWeek(now).toISOString())
          .order('started_at', { ascending: false }),
        supabase.from('workouts').select('*').order('started_at', { ascending: false }).limit(10),
        supabase.from('daily_activity').select('*').eq('day', dayKey(now)).maybeSingle(),
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
        .order('week_start', { ascending: false })
        .limit(weeks);
      if (error) throw error;
      return data.reverse();
    },
  });
}
