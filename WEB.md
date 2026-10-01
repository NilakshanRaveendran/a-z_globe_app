# Browser and iPhone preview

The same Expo app now runs on Android, iOS, and the web. Native builds retain React Native Firebase and MMKV; browser builds use the Firebase JavaScript SDK and localStorage.

## Open on your iPhone

From the repository root:

```sh
npm ci
npm run build:web
npm run preview:web
```

The preview command prints a localhost address and this Mac's LAN address. Connect the iPhone to the same Wi-Fi and open the LAN address in Safari. Keep the Mac awake and the server running. The server uses port 4173, or the next free port up to 4200. Permit incoming connections if macOS asks. This exposes only the exported `apps/azglobe/dist` folder, not the repository.

For live editing, `npm run web` starts Expo's web development server instead. The service worker is only registered in production exports so it does not cache development bundles.

## Install and use offline

Host the contents of `apps/azglobe/dist` at the root of an HTTPS origin. The export is a static single-page app; configure the host to return `index.html` for application routes. Serve `sw.js` and `index.html` with revalidation (`Cache-Control: no-cache`) and JavaScript with a JavaScript MIME type. Keep `/__/` available for Firebase's auth helper when using Firebase Hosting.

Open that HTTPS address in Safari, choose Share, then Add to Home Screen. The manifest and Apple touch icon provide the name and icon. An HTTP LAN preview is enough to inspect the screens, but iPhone service workers, offline support, and location require a secure HTTPS origin.

Workbox precaches the exported app shell, bundled artwork, and fonts. Firebase API responses and writes are not cached by the service worker. Live authentication, placing orders, and fetching current data require a connection. Updated workers wait until the old app windows close, avoiding a forced reload during checkout. Close all open copies and reopen after deploying an update.

## Demo versus live Firebase

In demo mode, Profile's **Switch to business account** opens the Business dashboard as Yaal Angaadi; **Switch to personal account** in Business Profile switches back. The two sides share one on-device catalogue: the demo business owns Mama's Kitchen and Yaal Angaadi (the same restaurants customers browse), and anything it changes — menus, sold-out dishes, offers, opening/closing, review replies — is what the customer side shows. Restaurants created with Add Restaurant start empty and appear to customers once opened. None of this reaches Firebase.

Business screens follow the supplied service-provider Figma layout, with persistent Messages, Orders, Home, and Profile tabs. Orders replaces the reference's customer Cart tab for the provider workflow. Home retains its restaurant navigation when switching tabs; group chats open without the footer. Reviews (Figma 385:5924) supports replies and hiding; notifications remain unfinished. Add Restaurant shows each step's missing fields when Next is tapped. Open or close a restaurant from the ⋮ menu on its Restaurant Management card.

With no web Firebase configuration, demo checkout places an order into that shared catalogue: it appears live on the business Orders screens, each step the business takes (accept, prepare, ready, picked up, delivered, or cancel) updates the customer's tracker, and a delivered order prompts for a review the business can reply to. Orders at restaurants no demo business operates move through their stages on a timer. Nothing is sent to a real restaurant and no payment is taken. Two browser tabs on the same device see each other's changes.

Home shows a live-order card only when there is an active order; tapping it opens Order Tracking, and Profile → My orders lists past orders. Hotel cards open the existing Coming Soon screen; they do not create hotel bookings. Configured Firebase accounts never receive demo data. Web controls use MUI icons; native builds retain their SVG icons.

For live data, register a Firebase **Web** app in your project. Set the public client values shown in `apps/azglobe/.env.example` in `apps/azglobe/.env.local`, or in the hosting build environment, then rebuild. API key, auth domain, project ID, and app ID are required together. Do not include a service-account key in the frontend.

Enable Phone authentication and add the HTTPS hostname to Firebase Authentication's authorized domains. Web phone sign-in uses Firebase's reCAPTCHA verifier. Native `google-services.json` and `GoogleService-Info.plist` files do not configure the browser build. Use Firebase test phone numbers while testing; live SMS, push notifications, and real payments have not been validated as part of the PWA conversion.

## Messaging prototype

The browser Messages tab now includes All, Joined, and Discover groups, previews and joining, group chat, replies, reactions, emoji search, message actions, polls, events and RSVP, shared files, location sharing, camera capture, and voice recording. Chats open above the main tabs; returning restores the Messages tab. The existing native messaging screen remains a placeholder.

Group and message changes persist per account in this browser's localStorage. Uploaded files and recordings use IndexedDB. Nothing in this messaging prototype is transmitted to other users, Firebase, or moderators. Local permission checks are not a server security boundary. Seeded membership counts, read receipts, and histories are illustrative; outgoing messages are saved locally. Live delivery, presence, push notifications, moderation, and server-enforced roles still require backend integration.

With Firebase unconfigured, open `http://localhost:4173/?messagingRole=provider` to test provider-only group creation and management. Normal demo users do not see these controls. This query parameter cannot override an authenticated Firebase account's role.

Any file type can be shared — photos, videos, audio, PDFs, Word/Excel/PowerPoint, text and code files, archives and anything else — up to ten files per message and 50 MB per file, from the share menu (Photos & Videos, Camera, Files, Audio) or by pasting or dropping files into a chat. Photos and videos show inline, audio plays in the chat, PDFs open in the browser's own viewer, and text files are shown as UTF-8 (or UTF-16) text; other formats open or download. Message text, file names and group names can be in any script, including Sinhala, Tamil, Arabic and emoji. Camera, microphone, clipboard, and current-location access depend on browser support and permission; use HTTPS when testing these on an iPhone. The camera also offers the system file picker. Location search currently uses a small local list with external map links, not a live places service. The bundled example voice note is synthetic demo audio.

Browser checks cover mobile WebKit and desktop Chromium navigation, text, replies, reactions, polls, and members. Extended Chromium checks use simulated camera/microphone devices; physical iPhone recording and permission prompts still need device testing.

## Checks

```sh
npm run typecheck:web
npm run test:web
npm run build:web
```

The web typecheck resolves `.web.ts` files. The existing native app/core typechecks remain available, and the root `typecheck` also needs the separate `functions` dependencies installed.

With the preview server running and Playwright Chromium installed, `node tools/provider.browser.mjs` checks business navigation, restaurant validation and persistence, account switching, and group chat at 320px, 393px, and 1280px. Set `PLAYWRIGHT_MODULE` to an installed Playwright module path if it is not available locally.
