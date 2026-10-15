// iOS 27 terminates apps at launch unless they adopt the UIScene life cycle.
// Expo SDK 57 ships ExpoAppSceneDelegate for this but prebuild doesn't wire it
// up yet, so this plugin does:
//   1. Info.plist declares a scene manifest pointing at ExpoAppSceneDelegate.
//   2. AppDelegate exposes its React Native factory and stops creating the
//      window itself; the scene delegate creates it and starts React Native.
// Remove this once `npx expo prebuild` generates a scene-based AppDelegate.

const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

const WINDOW_START = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle: expected a Swift AppDelegate');
    }
    let src = cfg.modResults.contents;
    if (src.includes('ExpoReactNativeFactoryProvider')) return cfg;

    const header = 'class AppDelegate: ExpoAppDelegate {';
    if (!src.includes(header) || !src.includes(WINDOW_START)) {
      throw new Error(
        'with-scene-lifecycle: AppDelegate.swift no longer matches the expected template. ' +
          'Check whether Expo now sets up the scene life cycle itself and remove this plugin.',
      );
    }
    src = src.replace(header, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    src = src.replace(
      WINDOW_START,
      '    // The window is created by ExpoAppSceneDelegate (UIScene life cycle, required on iOS 27).\n',
    );
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};
