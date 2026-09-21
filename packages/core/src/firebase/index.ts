import { getApp, getApps } from '@react-native-firebase/app';

/**
 * React Native Firebase initialises itself from the native config files
 * (google-services.json / GoogleService-Info.plist). Those are not committed, so
 * until a Firebase project is wired up there is no default app and every call
 * would throw.
 *
 * `isFirebaseReady()` lets the data layer fall back to the Figma fixtures, which
 * keeps UI work and design-parity checks unblocked. Once the config files are in
 * place under ./firebase and a dev-client build is installed, the same
 * repositories talk to Firestore with no other change.
 */
export function isFirebaseReady(): boolean {
  try {
    return getApps().length > 0 && getApp() != null;
  } catch {
    return false;
  }
}

export { getApp };
