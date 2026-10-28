import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import type { Profile } from '@/lib/database.types';
import { signOutOfGoogle } from '@/lib/google-auth';
import { AVATAR_BUCKET } from '@/lib/profile-photo';
import { unregisterDevice } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { resetWidget } from '@/widgets/sync';

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
        | 'notify_comments'
        | 'notify_incentives'
        | 'mascot'
        | 'min_workout_minutes'
        | 'min_walk_minutes'
        | 'count_walks'
        | 'avatar_url'
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
    // Goal, timezone and "What counts" changes recompute the streak and XP server-side.
    await queryClient.invalidateQueries({ queryKey: ['home'] });
    if ('min_workout_minutes' in patch || 'min_walk_minutes' in patch || 'count_walks' in patch) {
      await queryClient.invalidateQueries({ queryKey: ['social'] });
    }
    return data;
  };
}

export async function signOut() {
  resetWidget();
  // Best effort: a failure here shouldn't block signing out.
  await unregisterDevice().catch(() => {});
  await signOutOfGoogle();
  await supabase.auth.signOut();
}

/**
 * Permanently deletes the account: the user's photos (check-ins and profile)
 * first (storage objects can't be removed from SQL), then the auth user,
 * which cascades through every table. Ends signed out.
 *
 * Someone who signed in with Apple confirms with Apple once more first, so the
 * app's access to their Apple ID can be revoked (cancelling stops the deletion).
 */
export async function deleteAccount(userId: string) {
  await revokeAppleSignIn();
  await unregisterDevice().catch(() => {});
  for (const bucket of [EVIDENCE_BUCKET, AVATAR_BUCKET]) {
    const paths = await listFiles(bucket, userId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
  }
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;

  resetWidget();
  await signOutOfGoogle();
  // The server session went with the user, so only clear the local one.
  await supabase.auth.signOut({ scope: 'local' });
}

/**
 * App Store Review Guideline 5.1.1(v): deleting an account made with Sign in
 * with Apple must revoke the app's Apple token. Apple only hands out a code
 * when asked, so ask, and let the revoke-apple Edge Function trade it in.
 * A failure on our side doesn't block deleting the account.
 */
async function revokeAppleSignIn() {
  const { data } = await supabase.auth.getSession();
  const usedApple = data.session?.user.identities?.some((i) => i.provider === 'apple');
  if (!usedApple || !(await AppleAuthentication.isAvailableAsync())) return;

  // Throws ERR_REQUEST_CANCELED if they back out, which stops the deletion.
  const { authorizationCode } = await AppleAuthentication.signInAsync({ requestedScopes: [] });
  if (!authorizationCode) return;
  const { error } = await supabase.functions.invoke('revoke-apple', { body: { code: authorizationCode } });
  if (error) console.warn('Could not revoke Sign in with Apple', error);
}

const EVIDENCE_BUCKET = 'evidence';

/** Every file path under `folder`, walking subfolders (entries without an id are folders). */
async function listFiles(bucket: string, folder: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data) {
      const path = `${folder}/${entry.name}`;
      if (entry.id) paths.push(path);
      else paths.push(...(await listFiles(bucket, path)));
    }
    if (data.length < 1000) return paths;
  }
}
