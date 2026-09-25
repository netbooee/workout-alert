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

  // Push tokens are tied to your EAS project. `npx eas-cli@latest init` prints
  // the ID; set EAS_PROJECT_ID in .env.local (or add it to app.json yourself).
  const easProjectId = process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId;
  const extra = easProjectId
    ? { ...config.extra, eas: { ...config.extra?.eas, projectId: easProjectId } }
    : config.extra;

  return { ...config, name: config.name ?? 'Streaks', slug: config.slug ?? 'streaks', plugins, extra };
};
