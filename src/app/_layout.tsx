import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, Palettes } from '@/constants/theme';
import { restoreAppearance } from '@/lib/appearance';
import { AuthProvider, useAuth } from '@/lib/auth';

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

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = !!session;
  const onboarded = !!profile?.onboarded_at;

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
        <Stack.Screen name="log" options={{ presentation: 'modal' }} />
        <Stack.Screen name="incentive/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="incentive/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-partner" options={{ presentation: 'modal' }} />
        <Stack.Screen name="invite/[code]" options={{ presentation: 'modal' }} />
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
      </Stack.Protected>
    </Stack>
  );
}
