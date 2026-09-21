#!/usr/bin/env node
/**
 * Strip a Figma MCP node export down to the illustration itself.
 *
 * `download_assets` renders a node in context: the export carries the page
 * background (`<rect fill="#F5F5F5">`), the enclosing section's outline and the
 * parent frames/buttons as huge off-canvas paths, with the real artwork nested
 * inside `<g id="Icon">`. This keeps the root <svg> and only that group's
 * children, plus any <defs> they reference.
 *
 * Usage: node tools/extract-icon-group.mjs <file.svg>... [--group Icon]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const gi = args.indexOf('--group');
const group = gi >= 0 ? args.splice(gi, 2)[1] : 'Icon';

for (const file of args) {
  const src = readFileSync(file, 'utf8');
  const open = src.match(/<svg[^>]*>/);
  const start = src.indexOf(`<g id="${group}"`);
  if (!open || start < 0) {
    console.error(`skip ${file}: no <g id="${group}">`);
    continue;
  }
  // Walk forward to the matching </g>, counting nested groups.
  let depth = 0;
  let i = start;
  let end = -1;
  const tag = /<(\/?)g\b[^>]*?(\/?)>/g;
  tag.lastIndex = start;
  for (let m; (m = tag.exec(src)); ) {
    if (m[1]) depth--;
    else if (!m[2]) depth++;
    if (depth === 0) {
      end = m.index + m[0].length;
      break;
    }
  }
  if (end < 0) {
    console.error(`skip ${file}: unbalanced groups`);
    continue;
  }
  const body = src.slice(start, end);
  const defs = src.match(/<defs>[\s\S]*<\/defs>/)?.[0] ?? '';
  const used = [...body.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  const keptDefs = used.length ? defs : '';
  writeFileSync(file, `${open[0]}\n${body}\n${keptDefs}${keptDefs ? '\n' : ''}</svg>\n`);
  console.log(`ok   ${file}  (${src.length} → ${body.length} bytes of artwork)`);
  void i;
}
