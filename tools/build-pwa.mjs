import { generateSW } from 'workbox-build';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../apps/azglobe/dist/', import.meta.url));
const { count, size, warnings } = await generateSW({
  globDirectory: dist,
  // The app shell only — code, styles, fonts, icons and the manifest — so the
  // first visit downloads what it needs to start, not every photo. Photos and
  // sounds are cached as they are first shown (runtimeCaching below).
  globPatterns: ['**/*.{html,js,css,ttf,woff,woff2}', 'icons/*.png', 'favicon.ico', 'manifest.json'],
  globIgnores: ['sw.js', 'workbox-*.js'],
  swDest: `${dist}/sw.js`,
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
  cacheId: 'azglobe',
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: false,
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/__\//],
  // Only same-origin app files are cached. Firebase requests and order writes
  // remain online operations, never a background replay queue.
  runtimeCaching: [
    {
      // Hashed, immutable bundle assets (photos, icons, sounds): cache on first
      // use, keep a bounded set.
      urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'azglobe-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
      },
    },
  ],
});
for (const warning of warnings) console.warn(warning);
console.log(`PWA: ${count} app files cached (${(size / 1024 / 1024).toFixed(1)} MB).`);
