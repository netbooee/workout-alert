import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import type { Profile } from '@/lib/database.types';
import { signOutOfGoogle } from '@/lib/google-auth';
import { unregisterDevice } from '@/lib/push';
import { supabase } from '@/lib/supabase';

interface AuthState {
  /** False until the stored session has been read from disk. */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
}

const AuthContext = createContext<AuthState>({ ready: false, session: null, profile: null });

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single();
      if (error) throw error;
      return data;
    },
  });

  const ready = sessionLoaded && (!userId || !profileQuery.isPending);

  return (
    <AuthContext.Provider value={{ ready, session, profile: profileQuery.data ?? null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** The signed-in user's profile. Only use inside signed-in screens. */
export function useProfile(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('useProfile called without a loaded profile');
  return profile;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return async (
    patch: Partial<
      Pick<
        Profile,
        | 'display_name'
        | 'weekly_goal'
        | 'timezone'
        | 'onboarded_at'
        | 'notify_nudges'
        | 'notify_partner_workouts'
        | 'notify_partner_requests'
        | 'notify_verifications'
        | 'notify_streak_reminders'
      >
    >,
  ) => {
    const userId = session?.user.id;
    if (!userId) throw new Error('Not signed in');
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    queryClient.setQueryData(['profile', userId], data);
    // Goal/timezone changes recompute the streak server-side.
    await queryClient.invalidateQueries({ queryKey: ['home'] });
    return data;
  };
}

export async function signOut() {
  // Best effort: a failure here shouldn't block signing out.
  await unregisterDevice().catch(() => {});
  await signOutOfGoogle();
  await supabase.auth.signOut();
}
