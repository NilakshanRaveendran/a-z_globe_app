#!/usr/bin/env node
/**
 * Figma design-spec extractor for A-Z Globe.
 *
 * The Figma file is the source of truth for this app. This tool prints the exact
 * measured spec of any node - size, auto-layout, padding, gap, radius, fills,
 * borders, shadows and full text styles - so screens are built from numbers
 * rather than from eyeballing a screenshot.
 *
 * Usage:
 *   node tools/figma-spec.mjs home                  annotated tree (by screen name)
 *   node tools/figma-spec.mjs 324:1708              annotated tree (by node id)
 *   node tools/figma-spec.mjs cart --depth 4        limit depth
 *   node tools/figma-spec.mjs cart --ids            show node ids (for --svg export)
 *   node tools/figma-spec.mjs cart checkout --png   render PNGs to design/reference/
 *   node tools/figma-spec.mjs <id> --svg <dir>       export SVG (colours -> currentColor)
 *   node tools/figma-spec.mjs <id> --svg dir --keep-colors  export SVG keeping its fills
 *   node tools/figma-spec.mjs --tokens              audit tokens across all screens
 *   node tools/figma-spec.mjs --screens             list the screen inventory
 *
 * Requires FIGMA_TOKEN in the environment or in .figma-token (gitignored)
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE_KEY = 'hwAIsP8GcASfiHLmozX1eQ';
const API = 'https://api.figma.com/v1';

/** The screens we build, from the approved plan. Shared with harvest-icons.mjs. */
const SCREENS = JSON.parse(readFileSync(new URL('./screens.json', import.meta.url), 'utf8'));

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

function hex(c) {
  const h = [c.r, c.g, c.b]
    .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  const a = c.a === undefined || c.a >= 0.999 ? '' : '@' + c.a.toFixed(2);
  return '#' + h + a;
}

let SHOW_IDS = false;

const num = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

function paint(p) {
  if (!p || p.visible === false) return null;
  if (p.type === 'SOLID') return hex({ ...p.color, a: p.opacity ?? p.color.a });
  if (p.type && p.type.startsWith('GRADIENT')) {
    const stops = p.gradientStops
      .map((s) => hex(s.color) + ' ' + Math.round(s.position * 100) + '%')
      .join(' -> ');
    return p.type.replace('GRADIENT_', '').toLowerCase() + '(' + stops + ')';
  }
  if (p.type === 'IMAGE') return 'image(' + String(p.imageRef).slice(0, 8) + ' ' + p.scaleMode + ')';
  return p.type;
}

function describe(n) {
  const bits = [];
  const b = n.absoluteBoundingBox;
  if (b) bits.push(num(b.width) + 'x' + num(b.height));

  if (n.layoutMode && n.layoutMode !== 'NONE') {
    let al = n.layoutMode === 'HORIZONTAL' ? 'row' : 'col';
    if (n.itemSpacing) al += ' gap:' + num(n.itemSpacing);
    const t = n.paddingTop || 0;
    const r = n.paddingRight || 0;
    const bo = n.paddingBottom || 0;
    const l = n.paddingLeft || 0;
    if (t || r || bo || l) {
      if (t === bo && l === r) al += ' pad:' + (t === l ? num(t) : num(t) + ' ' + num(l));
      else al += ' pad:' + [t, r, bo, l].map(num).join(' ');
    }
    if (n.primaryAxisAlignItems && n.primaryAxisAlignItems !== 'MIN')
      al += ' justify:' + n.primaryAxisAlignItems.toLowerCase();
    if (n.counterAxisAlignItems && n.counterAxisAlignItems !== 'MIN')
      al += ' align:' + n.counterAxisAlignItems.toLowerCase();
    bits.push(al);
  }

  if (n.rectangleCornerRadii) {
    const [tl, tr, br, bl] = n.rectangleCornerRadii;
    bits.push(
      tl === tr && br === bl && tl === br
        ? 'r:' + num(tl)
        : 'r:' + [tl, tr, br, bl].map(num).join(' ')
    );
  } else if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) {
    bits.push('r:' + (n.cornerRadius > 999 ? 'pill' : num(n.cornerRadius)));
  }

  const fills = (n.fills || []).map(paint).filter(Boolean);
  if (fills.length && n.type !== 'TEXT') bits.push('fill:' + fills.join(','));

  const strokes = (n.strokes || []).map(paint).filter(Boolean);
  if (strokes.length) bits.push('border:' + strokes.join(',') + '/' + num(n.strokeWeight ?? 1));

  for (const e of n.effects || []) {
    if (e.visible === false) continue;
    if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
      const kind = e.type === 'INNER_SHADOW' ? 'inner' : 'shadow';
      const spread = e.spread ? ' ' + num(e.spread) : '';
      bits.push(
        kind + ':' + num(e.offset.x) + ' ' + num(e.offset.y) + ' ' + num(e.radius) + spread + ' ' + hex(e.color)
      );
    }
    if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') bits.push('blur:' + num(e.radius));
  }

  if (n.opacity !== undefined && n.opacity < 1) bits.push('opacity:' + num(n.opacity));

  if (n.type === 'TEXT') {
    const s = n.style || {};
    const color = (n.fills || []).map(paint).filter(Boolean)[0] || '';
    const ls = s.letterSpacing ? ' ls' + num(s.letterSpacing) : '';
    const align =
      s.textAlignHorizontal && s.textAlignHorizontal !== 'LEFT'
        ? ' ' + s.textAlignHorizontal.toLowerCase()
        : '';
    bits.push(
      'text:' + s.fontFamily + ' ' + s.fontWeight + ' ' + num(s.fontSize) + '/' + num(s.lineHeightPx) + ls + ' ' + color + align
    );
  }
  return bits.join('  ');
}

function tree(n, indent, maxDepth) {
  const pad = '  '.repeat(indent);
  const label = n.type === 'TEXT' ? JSON.stringify((n.characters || '').slice(0, 44)) : n.name;
  const id = SHOW_IDS ? '  <' + n.id + '>' : '';
  console.log((pad + label + '  ' + describe(n) + id).trimEnd());
  if (indent < maxDepth) for (const c of n.children || []) tree(c, indent + 1, maxDepth);
}

/** Walk every screen and report which token values are actually used. */
async function auditTokens() {
  const ids = Object.values(SCREENS).join(',');
  const data = await api('/files/' + FILE_KEY + '/nodes?ids=' + encodeURIComponent(ids));
  const typo = new Map();
  const fill = new Map();
  const radius = new Map();
  const gap = new Map();
  const padv = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const walk = (n) => {
    if (n.type === 'TEXT' && n.style) {
      bump(typo, n.style.fontFamily + ' ' + n.style.fontWeight + ' ' + num(n.style.fontSize) + '/' + num(n.style.lineHeightPx));
    }
    for (const f of n.fills || []) if (f.visible !== false && f.type === 'SOLID') bump(fill, hex(f.color));
    if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0)
      bump(radius, n.cornerRadius > 999 ? 'pill' : num(n.cornerRadius));
    if (n.itemSpacing) bump(gap, num(n.itemSpacing));
    for (const k of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'])
      if (n[k]) bump(padv, num(n[k]));
    (n.children || []).forEach(walk);
  };
  for (const v of Object.values(data.nodes)) walk(v.document);
  const show = (title, m, limit) => {
    console.log('\n-- ' + title + ' --');
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .forEach(([k, v]) => console.log('  ' + String(v).padStart(4) + 'x  ' + k));
  };
  show('TYPOGRAPHY', typo, 30);
  show('FILL COLORS', fill, 30);
  show('CORNER RADII', radius, 15);
  show('GAPS', gap, 15);
  show('PADDING', padv, 15);
}

/**
 * Export nodes as SVG. Icons in this design are vector shapes drawn in Figma, so
 * exporting them verbatim keeps the app pixel-identical instead of substituting
 * a look-alike icon set.
 */
async function svg(ids, names, outDir, keepColors) {
  mkdirSync(outDir, { recursive: true });
  const data = await api(
    '/images/' + FILE_KEY + '?ids=' + encodeURIComponent(ids.join(',')) + '&format=svg&svg_outline_text=false'
  );
  for (const [id, url] of Object.entries(data.images)) {
    if (!url) {
      console.error('  !! no SVG for ' + id);
      continue;
    }
    const name = names[id] || id.replace(':', '-');
    const file = join(outDir, name + '.svg');
    let body = await (await fetch(url)).text();
    if (!keepColors) {
      // Monochrome glyphs: Figma bakes the source colour into the markup, so swap
      // it for currentColor and one component can render active and inactive.
      // Multi-colour illustrations (the cuisine chips and category circles) must
      // keep their fills — pass --keep-colors for those.
      body = body.replace(/(fill|stroke)="(?:#(?!none)[0-9A-Fa-f]{3,8}|white|black)"/g, '$1="currentColor"');
    }
    writeFileSync(file, body);
    console.log('  -> ' + file + '  (' + body.length + ' bytes)');
  }
}

async function png(ids, names) {
  mkdirSync('design/reference', { recursive: true });
  const data = await api(
    '/images/' + FILE_KEY + '?ids=' + encodeURIComponent(ids.join(',')) + '&format=png&scale=2'
  );
  for (const [id, url] of Object.entries(data.images)) {
    if (!url) {
      console.error('  !! no render for ' + id);
      continue;
    }
    const name = names[id] || id.replace(':', '-');
    const file = join('design/reference', name + '.png');
    writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
    console.log('  -> ' + file);
  }
}

// ---- CLI ----------------------------------------------------------------
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const depthIdx = argv.indexOf('--depth');
const maxDepth = depthIdx >= 0 ? Number(argv[depthIdx + 1]) : 99;
SHOW_IDS = flags.has('--ids');
const svgIdx = argv.indexOf('--svg');
const svgTakesValue = svgIdx >= 0 && argv[svgIdx + 1] && !argv[svgIdx + 1].startsWith('--');
const positional = argv.filter(
  (a, i) =>
    !a.startsWith('--') &&
    !(depthIdx >= 0 && i === depthIdx + 1) &&
    !(svgTakesValue && i === svgIdx + 1)
);

if (flags.has('--help') || (!positional.length && !flags.size)) {
  console.log('node tools/figma-spec.mjs <screen|nodeId> [--depth N] [--png]');
  console.log('node tools/figma-spec.mjs --screens | --tokens');
} else if (flags.has('--screens')) {
  for (const [k, v] of Object.entries(SCREENS)) console.log('  ' + k.padEnd(24) + v);
} else if (flags.has('--tokens')) {
  await auditTokens();
} else {
  const names = {};
  const ids = positional.map((a) => {
    const id = SCREENS[a] || a.replace(/^(\d+)-(\d+)$/, '$1:$2');
    names[id] = SCREENS[a] ? a : id.replace(':', '-');
    return id;
  });
  if (flags.has('--png')) {
    await png(ids, names);
  } else if (flags.has('--svg')) {
    const outIdx = argv.indexOf('--svg');
    const outDir =
      argv[outIdx + 1] && !argv[outIdx + 1].startsWith('--')
        ? argv[outIdx + 1]
        : 'packages/core/assets/icons/app';
    await svg(ids, names, outDir, flags.has('--keep-colors'));
  } else {
    const data = await api('/files/' + FILE_KEY + '/nodes?ids=' + encodeURIComponent(ids.join(',')));
    for (const id of ids) {
      const node = data.nodes[id] && data.nodes[id].document;
      if (!node) {
        console.error('  !! node ' + id + ' not found');
        continue;
      }
      console.log('\n=== ' + node.name + '  (' + id + ') ===');
      tree(node, 0, maxDepth);
    }
  }
}
