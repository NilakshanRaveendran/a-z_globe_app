import type { ExpoConfig } from 'expo/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Firebase native config files are not committed. Until they exist the app still
 * bundles and runs for UI work — only native Firebase calls are unavailable.
 * Drop them in <repo>/firebase/app/ (see firebase/README.md) to enable a
 * dev-client build.
 *
 * Resolved against __dirname, NOT the working directory. Expo evaluates this
 * file with cwd set to the app directory, so a relative './firebase/…' silently
 * found nothing after the monorepo move and every Firebase plugin was dropped
 * from the prebuild without a word of warning.
 *
 * A-Z Globe is one app serving both kinds of account — a customer and a
 * supplier sign in here with different accounts and get different experiences
 * (see `src/app/navigation/RootNavigator.tsx`), so there is one applicationId
 * and one config.
 */
const FIREBASE_DIR = join(__dirname, '..', '..', 'firebase', 'app');
const ANDROID_GOOGLE_SERVICES = join(FIREBASE_DIR, 'google-services.json');
const IOS_GOOGLE_SERVICES = join(FIREBASE_DIR, 'GoogleService-Info.plist');

const hasAndroidFirebase = existsSync(ANDROID_GOOGLE_SERVICES);
const hasIosFirebase = existsSync(IOS_GOOGLE_SERVICES);
const hasFirebase = hasAndroidFirebase || hasIosFirebase;

const config: ExpoConfig = {
  name: 'A-Z Globe',
  slug: 'azglobe',
  scheme: 'azglobe',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',

  web: {
    bundler: 'metro',
    output: 'single',
    name: 'A-Z Globe',
    shortName: 'A-Z Globe',
    favicon: './assets/icon.png',
  },

  ios: {
    bundleIdentifier: 'com.azglobe.app',
    supportsTablet: false,
    ...(hasIosFirebase ? { googleServicesFile: IOS_GOOGLE_SERVICES } : {}),
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'A-Z Globe uses your location to show restaurants and services near you and to deliver your orders.',
      UIBackgroundModes: ['remote-notification'],
    },
  },

  android: {
    package: 'com.azglobe.app',
    ...(hasAndroidFirebase ? { googleServicesFile: ANDROID_GOOGLE_SERVICES } : {}),
    adaptiveIcon: {
      // White rather than the brand red: the mark is multicolour, and red
      // behind its red/orange figures flattens them.
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
  },

  plugins: [
    'expo-font',
    'expo-image',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 280,
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
      },
    ],
    'expo-dev-client',
    // The React Native Firebase plugins fail prebuild outright when the native
    // config files are absent, so they are only registered once those exist.
    // Without them the app still builds and runs against the Figma fixtures —
    // see `isFirebaseReady()` in @azglobe/core.
    ...(hasFirebase
      ? ['@react-native-firebase/app', '@react-native-firebase/auth', '@react-native-firebase/messaging']
      : []),
    [
      'expo-build-properties',
      {
        // React Native Firebase v26 links the Firebase iOS SDK via SPM, which
        // requires dynamic frameworks. Only needed when Firebase is wired up.
        ...(hasIosFirebase ? { ios: { useFrameworks: 'dynamic' as const } } : {}),
        android: {
          minSdkVersion: 24,
          // Gradle compiles the native modules once per ABI and writes the
          // artifacts into node_modules — all four ABIs cost ~16 GB and a long
          // build. Narrow it locally with e.g.
          //   AZ_BUILD_ARCHS=x86_64 npx expo prebuild --clean
          // Release builds and CI set nothing and keep all four.
          ...(process.env.AZ_BUILD_ARCHS
            ? { buildArchs: process.env.AZ_BUILD_ARCHS.split(',') }
            : {}),
        },
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'A-Z Globe uses your location to show restaurants and services near you.',
      },
    ],
    './plugins/withReleaseSigning',
  ],

  experiments: { typedRoutes: false },
};

export default config;
