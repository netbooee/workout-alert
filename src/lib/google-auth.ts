import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

import { supabase } from '@/lib/supabase';

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Google sign-in is only offered when a client ID is configured. */
export const googleEnabled = !!iosClientId;

if (googleEnabled) {
  GoogleSignin.configure({ iosClientId });
}

/** Shows Google's account picker and signs into Supabase with the ID token. */
export async function signInWithGoogle(): Promise<void> {
  let idToken: string | null;
  try {
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return; // user cancelled
    idToken = response.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return;
    throw e;
  }
  if (!idToken) throw new Error('Google did not return an ID token.');

  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
}

/** Clears the cached Google account so the picker shows again next time. */
export async function signOutOfGoogle(): Promise<void> {
  if (!googleEnabled) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google; nothing to clear.
  }
}
