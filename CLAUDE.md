# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A-Z Globe — a multi-service app for Sri Lanka (Food is the only live module). One Expo SDK 57 / React Native 0.86 app that ships to Android, iOS and the web (PWA), backed by Firebase project `a-z-globe-d0d4b` (CLI alias `a-zglobe`) on the **Spark plan**.

npm workspaces monorepo:

- `apps/azglobe` (`@azglobe/app`) — the single app, serving both customer and supplier accounts
- `packages/core` (`@azglobe/core`) — design tokens, UI kit, Firebase/storage wrappers, account types. Module-agnostic: it must never know about restaurants or orders
- `functions/` — Cloud Functions, written and typechecked but **not deployed** (needs Blaze). Not a workspace; it has its own `package-lock.json` and needs its own `npm install`
- `tools/` — Node scripts and all tests
- `design/specs/` — committed Figma spec snapshots (grep these instead of hitting the Figma API)

`README.md` and `WEB.md` are detailed and worth reading, but parts of the README predate the monorepo rename: `apps/customer`, `npm run customer`, `npm run seed` and `src/core/...` are now `apps/azglobe`, `npm run app`, (removed) and `packages/core/src/...`.

## Commands

Run from the workspace root unless noted.

```bash
npm install                 # all workspaces
npm run app                 # Metro for the dev client (expo start --dev-client)
npm run web                 # Expo web dev server, port 8081
npm run android             # expo run:android   (ios: npm run ios, macOS only)

npm run typecheck           # native app + core + functions (functions deps must be installed)
npm run typecheck:web       # same sources, resolving *.web.ts(x) variants — run both after touching platform-split files

npm run test:web            # node --test over tools/*.test.mjs
node --test tools/order-steps.test.mjs                            # one file
node --test --test-name-pattern "delivery" tools/order-steps.test.mjs   # one test

npm run test:rules          # Firestore emulator (port 8085) + tools/rules-test.mjs
npm run verify:live         # non-destructive assertions against the DEPLOYED rules

npm run build:web           # expo export + tools/build-pwa.mjs (Workbox) → apps/azglobe/dist
npm run preview:web         # serve the production build on :4173
npx firebase-tools deploy --only hosting --project a-zglobe
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project a-zglobe
```

- There is no lint script and no Jest. Tests are plain `node:test` files that load a TypeScript source with `module.stripTypeScriptTypes` and import it as a data URL — so they need Node ≥ 22.13, and a module under test must be importable standalone (no path aliases or RN imports in the tested file).
- Use `npx firebase-tools`, never `npx firebase` — the latter resolves to the JS SDK in this workspace, which has no executable. Always pass `--project a-zglobe`.
- `tools/provider.browser.mjs` is a Playwright check that expects `npm run preview:web` to be running.
- Native builds: `cd apps/azglobe && npx expo prebuild --clean`. `android/` and `ios/` are generated and gitignored — never hand-edit them; change `app.config.ts` or `plugins/withReleaseSigning.js` instead.
- If an edit seems not to apply in Metro, restart with `npx expo start --clear` before debugging — the file watcher is unreliable on this drive.

## Architecture

### Two runtime modes: demo and Firebase

`isFirebaseReady()` (`@core/firebase`) is the switch that every service/repository branches on.

- **Native**: true only when `firebase/app/google-services.json` / `GoogleService-Info.plist` exist (gitignored; `app.config.ts` registers the RN Firebase plugins only if present).
- **Web**: true only when the `EXPO_PUBLIC_FIREBASE_*` vars are set (`apps/azglobe/.env.local`, see `.env.example`).

When false, the app runs as the design user "Vanan" on a **demo marketplace** (`modules/food/services/demoCatalogue.ts`): Figma fixtures plus an on-device store (MMKV / localStorage) that the customer and business sides both read and write, so the full order flow works without a backend. Any new service function needs both branches, and demo data must never leak into Firebase mode.

### Platform splits

Native uses React Native Firebase + MMKV; web uses the Firebase JS SDK + localStorage. The split is done with `.web.ts(x)` siblings (`packages/core/src/firebase/*.web.ts`, `storage.web.ts`, `ui/icons.web.tsx`, `alert.web.ts`, …), and app code imports only through the `@core/firebase/*` and `@core/storage` wrappers — never from `@react-native-firebase/*` or `firebase/*` directly.

### Messaging (A-Z Groups)

`src/modules/messaging` — the screens are browser code (DOM/CSS/MUI, `*.web.tsx`), used on every platform:

- **Web**: `entry.web.tsx` lazy-loads them as a separate chunk.
- **Native**: `MessagingEmbed.tsx` shows the same code in a WebView. `tools/build-messaging-embed.mjs` (esbuild) bundles `embed/main.web.tsx` into one inlined HTML document at `embed/generated/html.js` (gitignored), swapping `@react-navigation/native`, `SessionProvider`, `@core/firebase`, `expo-asset` and `./transport.web` for the stand-ins in `embed/`. Run `npm run build:messaging` after editing anything under `messaging/` — a native build bundles whatever `html.js` currently holds (`npm install`, `npm run app` and `npm run android` rebuild it).

Data follows the demo/Firebase switch. In demo mode the groups are seeded examples in localStorage. With Firebase they are shared and private, WhatsApp-style: a supplier creates a group, admins add people **by phone number** (`chatDirectory/{phone}`, get-only), promote/dismiss admins and remove members. The pieces:

- `store.web.ts` keeps the screens' API (`state`, `update(fn)`); `sync.ts#diffState` turns each whole-state change into per-document `Op`s.
- `remote.ts` runs those against Firestore (`chatGroups/{id}` + `messages/`, `chatFiles`, `chatDirectory`, `chatUsers`, `chatReports`) and holds the listeners. It is platform-neutral.
- `transport.web.ts` calls `remote.ts` directly on web; inside the WebView, `embed/transport.web.ts` proxies the same calls over `postMessage` to `MessagingEmbed.tsx`, because the page has no Firebase sign-in of its own.
- Attachments are base64 in `chatFiles` (no Cloud Storage on Spark), so a shared file is capped at 700 KB; photos are downscaled to fit.
- Group documents keep `members` (map) and `memberIds` (array) in step — the rules require it.

Path aliases (`@/`, `@app/`, `@modules/`, `@core/`) are defined in both `babel.config.js` and `tsconfig.json`; keep them in sync.

### Shell, modules and the registry

`src/modules/registry.ts` is the one place a service module is plugged in. It drives the Home "Our Services" grid, the routes `RootNavigator` mounts, the sections a module contributes to Home, and the supplier dashboard's service list. Adding a module = a folder under `src/modules/<id>/` plus one registry entry; `src/app` (the shell) must not import a module's domain code.

The Food module is layered `services/` (repositories, demo/Firebase branching) → `hooks/` (TanStack Query) → `screens/`/`components/`, with Zustand stores in `store/` for cart, selected address and active order.

### Two account kinds, two navigation trees

A customer (`customers/{uid}`) and a supplier (`suppliers/{uid}`) are always separate Firebase users; a uid can never hold both. `SessionProvider` resolves an `AuthStage` and `accountKind`, and `RootNavigator` mounts an entirely different tree for each — customer tabs + module navigators, or `src/supplier/` (dashboard → restaurant management → restaurant hub → leaf screens). `account-unknown` (lookup failed) is deliberately distinct from `needs-account-type` (lookup found nothing); don't collapse them.

The supplier services in `src/supplier/services/` are the only writers of the catalogue.

### Orders and rules

Because Functions can't deploy on Spark, the **client writes order documents** and `firestore.rules` validates them. Three things encode the same order lifecycle (`new → accepted → preparing → ready_for_pickup → picked_up → delivered`, plus `cancelled`/`refunded`) and must change together:

- `validTransition()` in `firestore.rules`
- `ALLOWED_TRANSITIONS` in `functions/src/index.ts`
- `nextStep()` / `stageTransitions()` in `apps/azglobe/src/supplier/services/orderSteps.ts`

After any rules change run `npm run test:rules`. The deployed rules can lag the repo: on 2026-10-04 the live ruleset was the 2026-09-30 release plus the messaging block only — the repo's delivery-pricing rules (`validDeliveryRules` and the distance checks) had not been deployed. Compare before deploying so a deploy does not ship more than intended. `tools/rules-test.mjs` drives the emulator's REST API directly on purpose (`@firebase/rules-unit-testing` breaks in the hoisted workspace).

Firestore reads go through `@core/firebase/db` (`readDoc`, `readCollection` with a `QuerySpec`); every list query is bounded with `limit`, and new composite queries need an entry in `firestore.indexes.json`.

### Design fidelity

Figma file `hwAIsP8GcASfiHLmozX1eQ`, page **App Flow**, section **New UI - App flow** is the source of truth (the similar-looking **DRAFT** section is superseded — never build from it).

- `packages/core/src/theme/tokens.ts` is the only place a colour, font size, radius or shadow may be written; components quote Figma node ids in doc comments. If a value is missing, measure it and add a token first.
- Measure with `node tools/figma-spec.mjs <screen>` (needs `FIGMA_TOKEN` in `.figma-token`), or read `design/specs/*.txt`.
- Icons are exported from Figma as SVG and imported as components (Metro SVG transformer). Always run `node tools/normalize-svg.mjs` after exporting — un-normalised exports render blank or white-on-white.
- Web/CSS font sizes (e.g. `messaging.css`) are in `rem`, not `px`.
