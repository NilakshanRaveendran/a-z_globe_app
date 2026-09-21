#!/usr/bin/env node
/**
 * Normalise Figma-exported SVG icons.
 *
 * Figma wraps most exports in a `<clipPath>` whose only child is a rect covering
 * the whole viewBox — visually a no-op. The ids it generates are per-node, not
 * per-file, so rendering the SAME icon twice on one screen puts two elements
 * with the same clip id into the tree; react-native-svg then resolves the second
 * reference to the first element's bounds and the icon silently disappears.
 * (Seen with phone.svg: it rendered in the "Call Now" button but vanished from
 * the Info row on the same screen.)
 *
 * Stripping the redundant clip removes the whole class of bug. Clips that
 * actually mask something are left alone.
 *
 * Usage:
 *   node tools/normalize-svg.mjs                 normalise every icon dir
 *   node tools/normalize-svg.mjs <dir>           normalise one
 *   node tools/normalize-svg.mjs --check         report only
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
// Icons live in two places: the shared UI glyphs in core, and the
// module-specific illustrations in the app that owns them.
const DEFAULT_ROOTS = ['packages/core/assets/icons', 'apps/azglobe/assets/icons'];
const explicit = args.find((a) => !a.startsWith('--'));
const roots = explicit ? [explicit] : DEFAULT_ROOTS.filter((d) => existsSync(d));
const checkOnly = args.includes('--check');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (entry.endsWith('.svg')) yield full;
  }
}

/** True when the clipPath's only child is a rect spanning the full viewBox. */
function isRedundantClip(body, id, width, height) {
  const block = new RegExp(
    `<clipPath id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">([\\s\\S]*?)</clipPath>`
  ).exec(body);
  if (!block) return false;
  const inner = block[1].trim();
  if (!/^<rect\b[^>]*\/>$/.test(inner)) return false;

  const w = /width="([\d.]+)"/.exec(inner)?.[1];
  const h = /height="([\d.]+)"/.exec(inner)?.[1];
  const x = /\bx="([\d.]+)"/.exec(inner)?.[1] ?? '0';
  const y = /\by="([\d.]+)"/.exec(inner)?.[1] ?? '0';
  if (x !== '0' || y !== '0') return false;
  // Figma rounds the clip rect (14.9968 for a 15pt icon), so compare with slack.
  return Number(w) >= Number(width) - 1 && Number(h) >= Number(height) - 1;
}

let changed = 0;
let scanned = 0;

for (const root of roots)
  for (const file of walk(root)) {
  scanned++;
  let body = readFileSync(file, 'utf8');
  const before = body;

  const width = /<svg[^>]*\bwidth="([\d.]+)"/.exec(body)?.[1] ?? '0';
  const height = /<svg[^>]*\bheight="([\d.]+)"/.exec(body)?.[1] ?? '0';

  for (const match of [...body.matchAll(/clip-path="url\(#([^)]+)\)"/g)]) {
    const id = match[1];
    if (!isRedundantClip(body, id, width, height)) continue;

    // Drop the attribute, the clipPath definition, and any <defs> left empty.
    body = body.replace(new RegExp(`\\s*clip-path="url\\(#${id}\\)"`, 'g'), '');
    body = body.replace(
      new RegExp(`\\s*<clipPath id="${id}">[\\s\\S]*?</clipPath>`, 'g'),
      ''
    );
  }

  body = body.replace(/\s*<defs>\s*<\/defs>/g, '');
  // A <g> that only existed to carry the clip is now pure noise.
  body = body.replace(/<g>\s*([\s\S]*?)\s*<\/g>/g, '$1');

  // Some Figma layers export a named colour rather than a hex one. The export
  // tools only rewrite hex to currentColor, so `stroke="white"` slipped through
  // and drew the icon white-on-white. Convert those too — safe now that the
  // clipPath (whose rect legitimately uses fill="white") has been removed.
  // Multi-colour illustrations (cuisine, category, offer art) keep their black
  // shadows and white highlights: their folders carry a `.keep-colors` marker.
  if (!existsSync(join(dirname(file), '.keep-colors')))
    body = body.replace(/(fill|stroke)="(white|black|#fff|#FFF|#ffffff|#FFFFFF|#000|#000000)"/g,
      (full, attr) => `${attr}="currentColor"`);

  if (body !== before) {
    changed++;
    if (!checkOnly) writeFileSync(file, body);
    console.log(`  ${checkOnly ? 'would fix' : 'fixed'}  ${file}`);
  }
}

console.log(`\n${changed} of ${scanned} icons ${checkOnly ? 'need normalising' : 'normalised'}.`);
