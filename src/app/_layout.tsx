import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLinkingURL } from 'expo-linking';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, Palettes } from '@/constants/theme';
import { restoreAppearance } from '@/lib/appearance';
import { AuthProvider, useAuth } from '@/lib/auth';
import { inviteCodeFromUrl } from '@/lib/invite-link';
import { clearPendingInvite, getPendingInvite, savePendingInvite } from '@/lib/pending-invite';

SplashScreen.preventAutoHideAsync();
restoreAppearance();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
});

// React Navigation reads these colors in JavaScript, so it gets plain hex values
// for the current scheme rather than the dynamic Colors.
function navigationTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'light' ? DefaultTheme : DarkTheme;
  const palette = Palettes[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.flame,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
    },
  };
}

export default function RootLayout() {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={navigationTheme(scheme)}>
          <StatusBar style="auto" />
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { ready, session, profile } = useAuth();
  const url = useLinkingURL();
  const signedIn = !!session;
  const onboarded = !!profile?.onboarded_at;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Hold on to an invite opened before onboarding is done; the partner step uses it.
  useEffect(() => {
    const code = url && inviteCodeFromUrl(url);
    if (ready && code && !(signedIn && onboarded)) savePendingInvite(code);
  }, [url, ready, signedIn, onboarded]);

  // Someone already onboarded who opened an invite while signed out (say, after
  // reinstalling) skips onboarding's partner step, so open the invite here.
  useEffect(() => {
    if (!ready || !signedIn || !onboarded) return;
    getPendingInvite()
      .then(async (code) => {
        if (!code) return;
        await clearPendingInvite();
        router.push({ pathname: '/invite/[code]', params: { code } });
      })
      .catch(() => {});
  }, [ready, signedIn, onboarded]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="workout/[id]"
          options={{ headerShown: true, title: '', headerBackTitle: 'Back', headerTransparent: true }}
        />
        <Stack.Screen
          name="week/[start]"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            headerTintColor: Colors.flame,
            headerTitleStyle: { color: Colors.text },
          }}
        />
        <Stack.Screen
          name="partner/[id]"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            headerTintColor: Colors.flame,
            headerTitleStyle: { color: Colors.text },
          }}
        />
        <Stack.Screen
          name="streak"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            headerTintColor: Colors.flame,
            headerTitleStyle: { color: Colors.text },
          }}
        />
        <Stack.Screen
          name="league"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            headerTintColor: Colors.flame,
            headerTitleStyle: { color: Colors.text },
          }}
        />
        <Stack.Screen name="log" options={{ presentation: 'modal' }} />
        <Stack.Screen name="incentive/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="incentive/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-partner" options={{ presentation: 'modal' }} />
        <Stack.Screen name="invite/[code]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="xp" options={{ presentation: 'modal' }} />
        <Stack.Screen name="share" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="welcome"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="greeting"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="celebrate"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="league-result"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
      </Stack.Protected>
    </Stack>
  );
}
