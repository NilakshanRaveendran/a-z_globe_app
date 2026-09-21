# Firebase native config

These two files are **not committed** — they contain project identifiers tied to your Firebase
project, and `.gitignore` excludes them.

```
firebase/app/google-services.json       Android  com.azglobe.app
firebase/app/GoogleService-Info.plist   iOS      com.azglobe.app
```

Package id: `com.azglobe.app`. One app serves both customer and supplier accounts — which one you
get is decided by the account you sign in with, not by which app you installed.

`app.config.ts` checks for these files. While they are absent:

- the React Native Firebase config plugins are not registered, so `expo prebuild` still works;
- `isFirebaseReady()` returns false and the app runs on the Figma fixtures.

Once they are present, run `npx expo prebuild --clean` and rebuild the dev client.

A service-account key (for `tools/seed.mjs`) goes here too, as `service-account.json` —
Project settings → Service accounts → Generate new private key. It is gitignored as well.
