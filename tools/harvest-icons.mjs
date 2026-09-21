#!/usr/bin/env node
/**
 * Harvest every icon vector out of a Figma screen as SVG.
 *
 * The design's icons are drawn in Figma, so we export the designer's own vectors
 * rather than substituting a look-alike icon set. Figma names almost all of them
 * "Icon", so each export is named from its surrounding context — the nearest
 * sibling text, then the nearest meaningfully-named ancestor — which makes the
 * output identifiable without opening every file.
 *
 * Usage:
 *   node tools/harvest-icons.mjs <screen|nodeId> [--out <dir>]
 *
 * Re-runs are safe: identical geometry is written once and reused.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FILE_KEY = 'hwAIsP8GcASfiHLmozX1eQ';
const API = 'https://api.figma.com/v1';

const SCREENS = JSON.parse(
  readFileSync(new URL('./screens.json', import.meta.url), 'utf8')
);

function getToken() {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  for (const f of ['.figma-token', '.env.local', '.env']) {
    if (existsSync(f)) {
      const m = readFileSync(f, 'utf8').match(/^FIGMA_TOKEN\s*=\s*(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  console.error('FIGMA_TOKEN not set. Add it to .figma-token or export it.');
  process.exit(1);
}

async function api(path) {
  const res = await fetch(API + path, { headers: { 'X-Figma-Token': getToken() } });
  if (!res.ok) throw new Error('Figma ' + res.status + ': ' + (await res.text()));
  return res.json();
}

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const GENERIC = new Set(['icon', 'container', 'vector', 'frame', 'group', 'paragraph', 'button', 'app', 'body', '']);

/** Icon-ish: a small node whose subtree is only vectors. */
function isIcon(n) {
  const b = n.absoluteBoundingBox;
  if (!b || b.width > 48 || b.height > 48 || b.width < 6 || b.height < 6) return false;
  if (!/icon/i.test(n.name) && n.type !== 'VECTOR') return false;
  if (n.type === 'VECTOR') return false; // prefer the wrapping frame
  const onlyVectors = (m) =>
    (m.children || []).every((c) => c.type === 'VECTOR' || c.type === 'GROUP' || onlyVectors(c));
  return (n.children || []).length > 0 && onlyVectors(n);
}

/** Build a name from nearby text, then ancestors. */
function nameFor(node, ancestors) {
  const parent = ancestors[ancestors.length - 1];
  const siblingText = (parent?.children || [])
    .filter((c) => c !== node)
    .map((c) => (c.type === 'TEXT' ? c.characters : findText(c)))
    .find(Boolean);
  if (siblingText) return slug(siblingText);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i];
    if (!GENERIC.has(a.name.toLowerCase().trim())) return slug(a.name);
  }
  return 'icon';
}

function findText(n) {
  if (n.type === 'TEXT' && n.characters) return n.characters;
  for (const c of n.children || []) {
    const t = findText(c);
    if (t) return t;
  }
  return null;
}

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const outDir = outIdx >= 0 ? argv[outIdx + 1] : 'apps/azglobe/assets/icons/_unused';
const target = argv.find((a) => !a.startsWith('--') && a !== argv[outIdx + 1]);
if (!target) {
  console.error('usage: node tools/harvest-icons.mjs <screen|nodeId> [--out dir]');
  process.exit(1);
}
const nodeId = SCREENS[target] || target.replace(/^(\d+)-(\d+)$/, '$1:$2');

const data = await api('/files/' + FILE_KEY + '/nodes?ids=' + encodeURIComponent(nodeId));
const root = data.nodes[nodeId];
if (!root) {
  console.error('node not found: ' + nodeId);
  process.exit(1);
}

const found = [];
(function walk(n, ancestors) {
  if (isIcon(n)) {
    found.push({ id: n.id, name: nameFor(n, ancestors) });
    return; // do not descend into an icon
  }
  for (const c of n.children || []) walk(c, [...ancestors, n]);
})(root.document, []);

if (!found.length) {
  console.log('no icons found in ' + nodeId);
  process.exit(0);
}

console.log('found ' + found.length + ' icons in ' + target);

mkdirSync(outDir, { recursive: true });

// Figma caps ids per request; chunk to stay well inside it.
const CHUNK = 40;
const seen = new Map(); // geometry -> filename, to dedupe repeats
const taken = new Set();
// Seed from what is already on disk so re-runs across screens do not re-export
// the same glyph under a new name (icons repeat heavily between screens).
const norm = (b) => b.replace(/id="[^"]*"|url\(#[^)]*\)/g, '');
for (const f of readdirSync(outDir)) {
  if (!f.endsWith('.svg')) continue;
  const base = f.replace(/\.svg$/, '');
  taken.add(base);
  seen.set(norm(readFileSync(join(outDir, f), 'utf8')), base);
}

for (let i = 0; i < found.length; i += CHUNK) {
  const batch = found.slice(i, i + CHUNK);
  const res = await api(
    '/images/' + FILE_KEY + '?ids=' + encodeURIComponent(batch.map((b) => b.id).join(',')) + '&format=svg'
  );
  for (const b of batch) {
    const url = res.images[b.id];
    if (!url) continue;
    let body = await (await fetch(url)).text();
    body = body.replace(/(fill|stroke)="(?:#(?!none)[0-9A-Fa-f]{3,8}|white|black)"/g, '$1="currentColor"');
    const geometry = norm(body);
    if (seen.has(geometry)) {
      console.log('  = ' + b.name + ' (duplicate of ' + seen.get(geometry) + ')');
      continue;
    }
    let name = b.name;
    let n = 2;
    while (taken.has(name)) name = b.name + '-' + n++;
    taken.add(name);
    seen.set(geometry, name);
    writeFileSync(join(outDir, name + '.svg'), body);
    console.log('  + ' + name + '.svg');
  }
}
