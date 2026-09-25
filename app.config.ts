import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extends app.json with settings that come from the environment (.env.local).
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];

  // Google Sign-In needs the iOS client ID reversed into a URL scheme. The
  // plugin is only added when a client ID is configured, so the app still
  // builds without Google set up (the button is hidden in that case).
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (googleIosClientId) {
    const id = googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    plugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: `com.googleusercontent.apps.${id}` },
    ]);
  }

  return { ...config, name: config.name ?? 'Streaks', slug: config.slug ?? 'streaks', plugins };
};
