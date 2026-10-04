#!/usr/bin/env node
/**
 * Bundle the browser messaging module into ONE self-contained HTML document
 * for the native app.
 *
 *   node tools/build-messaging-embed.mjs
 *
 * Messaging is written for the browser, so Android and iOS show it in a
 * WebView (`apps/azglobe/src/modules/messaging/MessagingEmbed.tsx`). The page
 * has no server to fetch from, so script, stylesheet, fonts and artwork are all
 * inlined. The app's navigation, session, Firebase guard and asset modules are
 * swapped for the stand-ins in `messaging/embed/`.
 *
 * Output: `messaging/embed/generated/html.js` (gitignored). Rebuild after
 * changing anything under `messaging/` — `npm install`, `npm run app` and
 * `npm run android` do it for you.
 */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'apps', 'azglobe');
const messaging = join(app, 'src', 'modules', 'messaging');
const embed = join(messaging, 'embed');
const core = join(root, 'packages', 'core', 'src');
const require = createRequire(join(app, 'package.json'));

/** Exact-match module swaps; everything else resolves normally. */
const swaps = {
  '@react-navigation/native': join(embed, 'navigation.web.ts'),
  '@app/providers/SessionProvider': join(embed, 'session.web.ts'),
  '@core/firebase': join(embed, 'firebase.web.ts'),
  'expo-asset': join(embed, 'asset.web.ts'),
  // The tokens only: the theme index also pulls in expo-font.
  '@core/theme': join(core, 'theme', 'tokens.ts'),
  '@core/utils/text': join(core, 'utils', 'text.ts'),
};

const result = await build({
  entryPoints: [join(embed, 'main.web.tsx')],
  bundle: true,
  write: false,
  outdir: 'out',
  format: 'iife',
  platform: 'browser',
  target: 'chrome80',
  minify: true,
  jsx: 'automatic',
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.jpg': 'dataurl', '.png': 'dataurl', '.m4a': 'dataurl' },
  plugins: [
    {
      name: 'embed-swaps',
      setup(b) {
        b.onResolve({ filter: /^(@|expo-asset$)/ }, (args) =>
          swaps[args.path] ? { path: swaps[args.path] } : undefined
        );
        // The page has no Firebase of its own: it reaches the shared groups
        // through the native app instead (embed/transport.web.ts).
        b.onResolve({ filter: /^\.\/transport\.web$/ }, (args) =>
          args.resolveDir === messaging ? { path: join(embed, 'transport.web.ts') } : undefined
        );
      },
    },
  ],
});

const script = result.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
const styles = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';

// The family names are the ones `fontFamily` in the tokens uses, so the
// stylesheet's --az-* font variables resolve to the same Urbanist files.
const fonts = ['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold'];
const fontFaces = (
  await Promise.all(
    fonts.map(async (weight) => {
      const file = require.resolve(`@expo-google-fonts/urbanist/${weight}/Urbanist_${weight}.ttf`);
      const data = (await readFile(file)).toString('base64');
      return `@font-face{font-family:"Urbanist_${weight}";src:url(data:font/ttf;base64,${data}) format("truetype");font-display:block}`;
    })
  )
).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>${fontFaces}html,body,#root{height:100%;margin:0;background:#fff;overscroll-behavior:none}body{-webkit-text-size-adjust:100%}</style>
<style>${styles.replaceAll('</style', '<\\/style')}</style>
</head>
<body>
<div id="root"></div>
<!--az-config-->
<script>${script.replaceAll('</script', '<\\/script')}</script>
</body>
</html>
`;

const out = join(embed, 'generated');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'html.js'), `module.exports = ${JSON.stringify(html)};\n`);
// Loadable on its own in a desktop browser, for checking the page without a device.
await writeFile(join(out, 'preview.html'), html);
console.log(`messaging embed: ${(html.length / 1024 / 1024).toFixed(2)} MB → ${join(out, 'html.js')}`);
