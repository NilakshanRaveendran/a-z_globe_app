import { getApp, getApps, initializeApp } from 'firebase/app';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (config.apiKey && config.authDomain && config.projectId && config.appId && !getApps().length) {
  initializeApp(config);
}

export function isFirebaseReady(): boolean {
  return getApps().some((app) => app.name === '[DEFAULT]');
}

export { getApp };
