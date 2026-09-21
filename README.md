# A-Z Globe

A multi-service mobile app for Sri Lanka — Food today, with Cabs, Funeral Services, Cleaning,
Vehicle Rental, Events, Goods Transport and Hotels to follow.

**This phase ships the Food module only** (delivery). The architecture is built so the other
modules drop in without touching the shell.

React Native (Expo SDK 57) · Firebase · iOS + Android.

---

## The Figma file is the source of truth

Every screen is built against
[A-Z New UI](https://www.figma.com/design/hwAIsP8GcASfiHLmozX1eQ/A-Z-New-UI) — file key
`hwAIsP8GcASfiHLmozX1eQ`, page **App Flow**, section **New UI - App flow**.

> The same page also contains a **DRAFT - UI - App flow** section whose frames look deceptively
> similar. Those are superseded. Never build from them.

Nothing is eyeballed from a screenshot. Measurements come out of the file directly:

```bash
echo "FIGMA_TOKEN=figd_..." > .figma-token   # gitignored

node tools/figma-spec.mjs --screens          # the screen inventory and node ids
node tools/figma-spec.mjs cart               # annotated spec tree for one screen
node tools/figma-spec.mjs cart --depth 4     # shallower
node tools/figma-spec.mjs cart --ids         # include node ids, for asset export
node tools/figma-spec.mjs --tokens           # audit type/colour/radius/spacing usage
node tools/figma-spec.mjs cart --png         # reference render → design/reference/
```

Output looks like this, and is what the component doc-comments quote:

```
FoodCard  174.5x272.5  col  r:16  fill:#FFFFFF  shadow:0 2 8 #000000@0.09
  Container  174.5x120  fill:image(8adeb667 FILL)
    Container  70x18  col pad:2 8  r:pill  fill:#D42B2B
      "Bestseller"  54x14  text:Urbanist 700 9/13.5 ls0.22 #FFFFFF
```

A snapshot of every screen's spec is committed under `design/specs/` so you can grep it without
hitting the API.

### Assets come from Figma too

Icons are the designer's own vectors, not a look-alike icon set:

```bash
node tools/harvest-icons.mjs restaurant-menu --out packages/core/assets/icons/app
node tools/figma-spec.mjs <nodeId> --svg apps/azglobe/assets/icons/category --keep-colors
node tools/normalize-svg.mjs                                         # always run after exporting
```

`normalize-svg` is not optional. Figma wraps exports in a `<clipPath>` whose id is
per-node rather than per-file, so rendering the same icon twice on one screen makes the second
copy vanish; it also sometimes emits `stroke="white"` instead of a hex colour, which draws the
icon white-on-white. The normaliser strips the redundant clip and converts named colours, and
`--check` reports without writing.

### Brand assets

The logo lives at `apps/azglobe/assets/icons/colored-LOGO-a-z.png` (a 10500² master with the circular mark above
a "GLOBE" wordmark). Every derived asset is generated from it:

```bash
python tools/make-brand-assets.py                  # requires Pillow, run from the root
cd apps/azglobe && npx expo prebuild --clean      # so the native project picks them up
```

The script splits the master at the blank band between mark and wordmark, because the two crops
serve different purposes: the **mark alone** becomes the app icon and Android adaptive foreground
(the wordmark is unreadable at 48dp and the launcher's mask would clip it), while the **full
lockup** becomes the splash and the sign-in screen's mark. The adaptive-icon plate is white, not
the brand red — red behind the mark's red and orange figures flattens them.

- `packages/core/assets/icons/app|nav|ui` — shared glyphs, recoloured via `currentColor`
- `apps/azglobe/assets/icons/cuisine|category` — multi-colour illustrations, fills preserved
- `apps/azglobe/assets/images/services` — the six "Our Services" tiles at 1×/2×/3×
- `apps/azglobe/assets/images/food` — catalogue photography

---

## Running it

```bash
npm install                                  # workspace root
cd apps/azglobe && npx expo run:android     # or run:ios on macOS
```

Two things bite on a fresh `expo prebuild --clean`, both inside the generated `android/`:

- **`local.properties` is not generated.** Gradle then fails with "SDK location not found". Set
  `ANDROID_HOME` to the SDK, or create
  it with `sdk.dir=<path to the Android SDK>` (forward slashes, even on Windows).
- **`reactNativeArchitectures` defaults to all four ABIs.** Gradle compiles the native modules once
  per ABI and writes the artifacts *into `node_modules`* — around 16 GB, and a long build. For a
  local emulator, narrow it to the one you need:
  ```
  reactNativeArchitectures=x86_64        # in android/gradle.properties
  ```
  Release builds and CI keep all four.

The app runs **without Firebase**. When no native Firebase config is present, `isFirebaseReady()`
is false and every repository falls back to the fixtures in
`src/modules/food/data/fixtures.ts` — content transcribed verbatim from Figma. That keeps UI work
and design-parity checks unblocked.

### Wiring up Firebase

Project: **`a-z-globe-d0d4b`**. Config files are gitignored; the
plugins are registered, and rules + indexes are deployed.

1. Config files live in `firebase/app/` for `com.azglobe.app`. `app.config.ts` resolves that
   directory against `__dirname`, **not** the working directory — a relative path silently found
   nothing after the monorepo move and every Firebase plugin was dropped from the prebuild without
   a word of warning.
   `app.config.ts` registers the React Native Firebase plugins only when they exist, so
   `expo prebuild` works with or without them.
2. Deploy rules and indexes after changing either:
   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes
   ```
3. **There is no seeding step.** The catalogue is created in the app: a supplier account adds a
   restaurant through Add Restaurant (Figma 385:4028), and that is what customers browse. Nothing
   a customer can order from was invented by a script.

   `tools/seed.mjs` is deprecated and unwired — it copied the Figma fixtures in before the supplier
   flow existed. `npm run clear:catalogue` removes anything it left behind (accounts and the
   platform food taxonomy are preserved).

   The fixtures in `src/modules/food/data/fixtures.ts` still back the **no-Firebase** design mode,
   where `isFirebaseReady()` is false — that keeps UI and design-parity work unblocked, and is
   never shown alongside real data.
4. Check the console-side setup is actually in place:
   ```bash
   node tools/check-firebase.mjs
   ```
   Reports Phone sign-in, test numbers and the Android SHA certificates from the APIs. The
   downloaded `google-services.json` lags behind console changes, so it is not a reliable signal
   on its own.

### A test build for Android phones

A standalone APK — the JavaScript is bundled in, so it needs no dev server and works on any
network. Build it with ARM only (real phones; ~65 MB):

```bash
cd apps/azglobe/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# → app/build/outputs/apk/release/app-release.apk  (copy to dist/, which is gitignored)
```

Add `x86_64` to the list to install the same build on the emulator.

**Signing.** Release builds are signed with the A-Z Globe release key in `credentials/`
(gitignored): `azglobe-release.jks` plus `release-signing.properties` holding its passwords. The
`plugins/withReleaseSigning.js` config plugin wires it into `build.gradle` on every prebuild; without
those files a release build falls back to the public debug key. **Back both files up somewhere
safe** — an installed app can only be updated by a build signed with the same key, and Google Play
uses it as the upload key. Its SHA-1/SHA-256 are registered on the Firebase Android app, which
phone sign-in needs on real devices.

A release build and the dev client are signed with different keys, so Android refuses to install
one over the other: uninstall first (`adb uninstall com.azglobe.app`).

**Sign-in on testers' phones.** Numbers listed under Firebase Console → Authentication → Sign-in
method → Phone → *Phone numbers for testing* sign in with their fixed code and no SMS. Any other
number receives a real SMS (Sri Lanka only — `LK` is the only allowed SMS region).

Never hand-edit `android/` — `expo prebuild --clean` regenerates it, and it is gitignored. The
Firebase Console's "add the SDK" and "add initialization code" steps are already done by the config
plugin (Gradle classpath, `apply plugin`, `FirebaseApp.configure()`, Podfile, and copying the
config files into place).

---

## Architecture

One repo, one shared foundation, an app per persona. `packages/core` is
module-agnostic — it knows about design tokens and Firebase, never about
restaurants or orders — which is what lets the ordering and business halves of
the app, and every module to come, sit on exactly the same foundation.

```
apps/
  customer/               the A-Z Globe app  (com.azglobe.app)
    src/app/              shell — navigation, providers, auth, shell screens
    src/modules/
      registry.ts         ← the ONE place a module is plugged in
      food/               navigation · screens · components · services · hooks · store · data · types
    src/supplier/         what a business account sees instead of the ordering experience
      screens/            dashboard · add restaurant · menu management · add item
      services/           restaurants.ts · menu.ts  (the only writers of the catalogue)
      components/         SupplierField — the provider form treatment (385:4028)
    assets/               app icon, splash, module artwork
                          (directory still named `customer`; it now serves both account
                          kinds and is due a rename)

packages/
  core/                   shared by every A-Z app
    src/theme/            tokens.ts — every colour, type style, radius, shadow
    src/ui/               Button · Chip · Card · Field · SearchBar · Sheet · StarRow · …
    src/firebase/         app guard · Firestore helpers
    src/account/          the two account kinds, and why they are separate
    src/utils/            currency, distances, time windows
    src/brand.ts          the A-Z mark
    assets/icons/         UI glyphs, nav icons, star
    assets/brand/         logo derivatives

functions/                Cloud Functions (written; needs Blaze to deploy)
tools/                    figma-spec · harvest-icons · normalize-svg · make-brand-assets · seed
                          check-firebase · migrate-accounts · rules-test
design/specs/             committed Figma spec snapshots
firestore.rules  firestore.indexes.json  storage.rules
```

Run things from the workspace root:

```bash
npm install                 # installs every workspace
npm run customer            # Metro for the customer app
npm run typecheck           # app, core and functions
npm run seed -- --supplier <supplierUid>
npm run check:firebase      # reports console-side setup
npm run test:rules          # 49 assertions against the emulator
npm run verify:live         # 9 assertions against the deployed rules
```

`check:firebase` reports what is missing; `tools/setup-firebase.mjs` puts it in place, so the
console-side setup is written down and repeatable rather than a sequence of clicks nobody can diff:

```bash
node tools/setup-firebase.mjs --sha <SHA-1> --package com.azglobe.app
node tools/setup-firebase.mjs --test-number +94772244482=123456
```

Both operations are additive — test numbers are read, merged and written back, because the
identity-toolkit PATCH replaces the whole map and writing only the new entry would delete the rest.

> A phone number cannot be both a **test number** and a **real account**. Register the test number
> *before* anyone signs in on it, and let the first sign-in create the user.

Native builds run from the app: `cd apps/azglobe && npx expo prebuild --clean`.

When a second A-Z app lands, the food domain it would share — types, the
order status machine, the Firestore repositories — gets extracted to
`packages/food`. It is deliberately left inside `apps/azglobe` until there is a
second consumer, so the boundary is drawn from real use rather than guessed at.

### Why a workspace

The provider app reuses the design tokens, the whole UI kit, the icon set, the
Firebase layer, the domain types and the order status machine. Duplicating those
into a standalone project would let them drift — which directly undercuts
"Figma is the source of truth". Shared code lives in `packages/core` and each
app stays thin.

### Adding the next module

1. Build `src/modules/<id>/` with its own navigator.
2. Add one entry to `src/modules/registry.ts`.

That is the whole change. The registry drives the Home services grid, the routes the root stack
mounts, and any sections the module contributes to Home — so nothing in `src/app` or `src/core`
needs editing.

### Design tokens

`src/core/theme/tokens.ts` is the only place a colour or font size may be written. Everything in it
is measured — re-derive with `node tools/figma-spec.mjs --tokens`.

| | |
| --- | --- |
| Typeface | Urbanist 400–900, line height 1.5× throughout |
| Primary | `#D42B2B`, tint `#FFF1F1` |
| Stars | `#FBBF24` · Success `#22C55E` |
| Text | `#111827` / `#1F2937` / `#6B7280` / `#9CA3AF` |
| Surfaces | `#FFFFFF` / `#F3F4F6` · borders `#E5E7EB` |
| Radii | 10 · 12 · 14 · 16 · 20 · pill |

React Native 0.76+ supports CSS `boxShadow`, so Figma's multi-layer shadows are reproduced exactly
rather than approximated with `elevation`.

---

## Accounts

A-Z Globe has **two kinds of account, and they are never the same Firebase user.**

| | |
| --- | --- |
| `customers/{uid}` | a person using A-Z Globe — ordering food, and later cabs, cleaning, hotels |
| `suppliers/{uid}` | a business operating *on* A-Z Globe — menus, orders, offers |

The same person may hold both. Someone who orders dinner on A-Z Globe and also runs a restaurant on
it signs in as **two separate Firebase users**, with two uids, two profile documents and two sets of
permissions. Because Firebase Auth keys phone accounts by number, the two accounts use different
phone numbers — which is the normal case anyway, since a restaurant has its own line.

**One app, not two.** A-Z Globe ships as a single application. Signing in resolves which kind of
account the uid holds (`accountKindOf`) and the root navigator mounts the matching tree — the
ordering experience, or the business dashboard. They are separate trees rather than a flag inside
one, because a supplier has no cart, no delivery address and no module grid; sharing a navigator
would mean guarding every screen instead of simply never mounting them.

A brand-new number is asked which kind it is signing up as, because the choice is not reversible for
a uid and cannot be guessed. A returning number never sees that step.

This is not bookkeeping. It means a restaurant owner can hand the business account to staff without
also handing over their home address, saved cards and order history; it means signing out of the
business does not sign you out of your dinner; and it means the business account can later be
transferred or co-owned without dragging a personal identity along with it.

`accountLinks/{customerUid}_{supplierUid}` records that two accounts belong to the same person, so
the app can offer account switching. It **grants no permission** — no rule in `firestore.rules`
reads it — which is what makes it safe to expand later without widening anyone's access. Both sides
must confirm a link.

Types live in `packages/core/src/account/` rather than in `modules/food`, because a supplier account
is the account that will own a hotel or a cab fleet too.

```
node tools/migrate-accounts.mjs --supplier-phone +94… [--dry-run]
```

migrates a project that predates the split (`users/` → `customers/`, `merchants.ownerId` →
`merchants.supplierId`). **Run it before deploying the current rules** — they have no rule matching
`/users/{uid}`, so a live app would lose access to its profile document.

## The supplier side

A business account gets a different app: no cart, no module grid, no delivery address. The catalogue
customers browse is created entirely here.

Figma's provider flow is three levels deep, and the app follows it exactly:

```
Dashboard (services hub)  →  Restaurant Management (list)  →  Restaurant Hub (6 areas)  →  leaf
   385:3033                     385:3424                        385:5072
```

The dashboard is a **services** hub, not a restaurant list: the same six A-Z modules the customer
sees on Home, seen from the other side — active ones under "Active Services", the rest under
"Available to Activate". It is driven by `modules/registry.ts`, so a module shipped for customers
appears here automatically. Restaurants live one level down, because a provider may run a hotel and
a cab fleet too.

| Screen | Figma | State |
| --- | --- | --- |
| Dashboard — stats, Active Services, Available to Activate | `385:3033` | built to spec |
| Restaurant Management — restaurant cards, Add Restaurant | `385:3424` | built to spec |
| Restaurant Hub — stats, the six management areas | `385:5072` | built to spec |
| Add Restaurant — 4 steps: basic info · location · hours · orders | `385:4028` `385:4261` `385:4500` `385:4762` | built to spec |
| Menu management — category filter, dish grid, availability, delete | `176:2923` | built to spec |
| Add Item — dish name, price, description, category, photo | no Figma node | composed from `385:4028` |
| Active Orders — status filters, order cards, accept → deliver, cancel | `335:4972` | built to spec |
| Restaurant Info — edit details, opening hours, **Set Pin** | `394:2730` | built to spec |
| Order History · Offers & Discounts · Reviews | `346:2826` `352:6743` — | rows present, marked coming soon |

The six hub-row icons are the designer's own vectors, exported from `385:5072` to
`packages/core/assets/icons/provider/`.

Specs for every provider screen are captured under `design/specs/m-*.txt`.

The action button on an order card is derived from its status by `nextStep()`, which mirrors
`validTransition()` in the rules — so the UI can only ever offer a move the database will accept.
Two rules assertions pin the exact documents the app writes (`createRestaurant` and the Restaurant
Info edit, map pin included), because the whole catalogue now flows through those two calls.

**Photos are not uploadable yet.** Cloud Storage requires the Blaze plan, so Add Item picks from the
dish artwork bundled with the app. Swapping to real uploads is one field in `AddMenuItemSheet` plus a
Storage write.

## Data model

```
customers/{uid}                  profile · addresses/ · paymentMethods/ · activeOrderId
suppliers/{uid}                  business profile · merchantIds
accountLinks/{cust}_{supp}       "same person" · confirmedBy[] · grants nothing
merchants/{id}                   module:'food' · supplierId · denormalised card fields
                                 · menuItems/ · reviews/
orders/{id}                      top-level · module:'food' · pricing · status · timeline
promotions/{CODE}                percent|fixed · minOrder · validUntil
popularDishes/{id}               denormalised, so Home is one cheap read
```

Order status runs `new → accepted → preparing → ready_for_pickup → picked_up → delivered`
(plus `cancelled` / `refunded`), exactly matching the merchant OrderCard set in Figma (335:5771).
The customer's three-node tracker collapses these via `trackerStage()` in
`src/modules/food/types`.

### Rules that matter

- A customer reads only their own orders; a supplier reads only orders placed with its restaurant.
- Only a **customer** account can place an order or write a review. Only a **supplier** account can
  own a restaurant, edit a menu, or advance an order's status.
- `ownsMerchant()` requires *both* that `merchants/{id}.supplierId` matches the caller **and** that
  the caller holds a `suppliers/{uid}` profile — so pointing that field at a customer uid grants
  nothing, by construction rather than by convention.
- A uid that already holds one kind of profile is refused the other, so the two identities cannot
  collapse into one user.
- A supplier cannot set or edit its own `rating`/`reviewCount`, nor reassign ownership.
- A review can only be created by someone with a `delivered` order from that restaurant.
- Catalogue data is public read; written only by the supplier that owns it.

### Testing the rules

```bash
npm run test:rules      # starts the Firestore emulator, runs 49 assertions, stops it
npm run verify:live     # checks the DEPLOYED rules against the real accounts
```

`verify:live` answers the one question the emulator cannot: that what is actually deployed, against the data that actually exists, behaves as intended for the real customer and supplier accounts. It signs in as each using an admin-minted custom token — no SMS, no test numbers — and is non-destructive: every assertion is a read, a write expected to be refused, or the one allowed write, which writes a field back to the value it already holds.

`tools/rules-test.mjs` drives the emulator's REST API directly rather than using
`@firebase/rules-unit-testing`, which needs the compat SDK and fails to register
it in a hoisted npm workspace (duplicate `@firebase/app-compat` instances leave
`app.firestore()` undefined). REST has no such problem and exercises identical
rules. The emulator is local and free.

The suite is mutation-tested: deleting the transition guard from
`firestore.rules` turns exactly the five lifecycle assertions red, so a green
run means something.

### Order writes — a deliberate trade-off

This project runs on the **Spark (free) plan**, and Cloud Functions v2 require Blaze. So the order
document is written **by the client**, and `firestore.rules` validates everything the rules
language can reach:

| Validated in rules | Not validated |
| --- | --- |
| Author is the signed-in user | **The item subtotal** |
| Status starts at `new`, timeline has one entry | |
| Merchant exists and is open | |
| Delivery fee matches that merchant's own document | |
| Total equals subtotal − promo + fees; promo ≤ subtotal | |
| Order is immutable to clients; only the merchant may move `status`/`timeline` | |
| The lifecycle itself — no skipping, no going backwards, no invented status | |
| Each transition appends one timeline entry matching the new status | |

Rules have **no loops**, so `items[]` cannot be summed against the menu documents — a modified
client could understate the subtotal.

`functions/src/index.ts#placeOrder` closes that gap and is written and typechecked. Deploying it on
Blaze and switching `placeOrder()` in
`apps/azglobe/src/modules/food/services/orders.ts` back to the callable is the only change needed;
`toRequest()` already builds the payload it expects.

The order **lifecycle** needs no such caveat: `validTransition()` in the rules mirrors
`ALLOWED_TRANSITIONS` in the function exactly, so status changes are fully enforced server-side on
Spark. Keep the two in step if either changes.

### Authentication

Phone / OTP via Firebase Auth, in `src/app/auth/`. Figma has no auth screens, so these are composed
from the design's own tokens — the Order-Placed tint circle, the Address-info field treatment, and
the standard sticky CTA.

`SessionProvider` resolves one of four stages and `RootNavigator` swaps the whole tree on it:

| Stage | Shown |
| --- | --- |
| `loading` | spinner |
| `signed-out` | phone entry |
| `needs-profile` | profile completion (verified number, no display name yet) |
| `ready` | the app |

With no Firebase project configured the stage is always `ready` and the app runs as the design user
("Vanan"), so auth never blocks UI work.

Firebase Console setup: enable **Phone** under Authentication → Sign-in method, add your debug
SHA-1 to the Android app, and add a **test phone number** so development never sends real SMS
(Spark allows only a small daily SMS quota).

One non-obvious step: Firebase ships new projects with an **empty SMS region allowlist**, and that
check runs *before* the test-number shortcut — so every sign-in fails with the opaque
`17006 SMS unable to be sent until this region enabled by the app developer`, test numbers
included. This project allowlists `LK` only, which is both what the app needs and safer than
allow-by-default (which invites SMS-pumping fraud). `node tools/check-firebase.mjs` reports it.

### Built to scale

- List-screen fields are denormalised, so a restaurant card is one document read.
- Every query is bounded (`limit` + `startAfter`) — no unbounded collection reads.
- Composite indexes are declared in `firestore.indexes.json` and deployed with the app.
- Exactly one realtime listener exists (the active order) and it detaches on blur.
- Geohash range queries (`geofire-common`) back the "near you" sections.

---

## What is built

All 21 customer screens and sheets from the Figma inventory, verified on an Android emulator
against the design (captures in `design/screens/`):

| | Figma |
| --- | --- |
| Home · Home with live order | `324:1708` · `324:2157` |
| Order Food landing | `31:11648` |
| Featured on A-Z Globe | `16:4256` |
| Restaurant — Menu / Reviews / Info | `17:4787` · `18:5057` · `18:5218` |
| All Menu Items | `26:10198` |
| Item detail (live option pricing) | `116:3078` · `116:3638` |
| Cart · Checkout · Order Placed | `414:2985` · `414:3339` · `416:4243` |
| Pay with · Write a Review · Addresses | `416:3862` · `426:3202` · `269:1496` |
| Address info · Choose building type | `400:4244` · `269:1625` |
| Personal Profile · BottomNav | `215:1152` · `31:12072` |

Plus the shell screens Figma's nav implies but never draws: Messages (empty state), the Cart tab,
and a coming-soon screen for the five unbuilt services.

---

## What is not in this phase

| | Why |
| --- | --- |
| Merchant app | Figma has a full one (`Service provider` section). Out of scope; "Switch to business account" routes to the coming-soon screen. |
| Pickup checkout | Figma only draws the `Pickup` filter chip. `orderType` exists in the model so a pickup flow is additive. |
| Messages screen | The tab is in Figma's BottomNav but no screen was designed. Renders an empty state. |
| Customer order history | No Figma screen. Tracking lives on the Home card. |
| The other 8 modules | Their tiles show on Home, as designed, and route to a coming-soon screen. |

---

## Development notes

- **Metro's file watcher does not pick up edits on this project's drive.** Changes only appear
  after `npx expo start --clear`. If a fix seems not to apply, restart Metro rather than debugging
  the code.
- Node 22.12 is below React Native 0.86's stated minimum (`^22.13.0`). Everything builds and runs,
  but npm prints an `EBADENGINE` warning — worth bumping Node.
- The first Android Gradle build takes ~30 minutes; subsequent builds are incremental.
- `android/local.properties` is generated, gitignored, and must point at your Android SDK.

### Faster local Android builds

Gradle compiles every native module once per ABI. All four (`armeabi-v7a`,
`arm64-v8a`, `x86`, `x86_64`) means a long build and ~16 GB of artifacts. An
emulator only needs one, and Gradle takes it as a property — no prebuild needed:

```bash
cd apps/azglobe/android
./gradlew assembleDebug -PreactNativeArchitectures=x86_64
```

For EAS or any build that goes through `expo prebuild`, `app.config.ts` also
reads `AZ_BUILD_ARCHS`, which has to be set **at prebuild time** because that is
when `gradle.properties` is written:

```bash
cd apps/azglobe && AZ_BUILD_ARCHS=x86_64 npx expo prebuild --clean
```

Setting it only on the `gradlew` command does nothing — the file is already
generated by then.

### Disk space

The Android build writes native artifacts **into `node_modules`** — Gradle puts
`android/build/intermediates` and `android/.cxx` inside each native package.
Reanimated, worklets, nitro-modules and expo-modules-core alone reached **16 GB**
here and filled the drive. They are pure build output; clearing them is safe and
just makes the next build slower:

```powershell
Get-ChildItem node_modules -Directory | ForEach-Object {
  @("$($_.FullName)\android\build", "$($_.FullName)\android\.cxx")
} | Where-Object { Test-Path $_ } | Remove-Item -Recurse -Force
```
