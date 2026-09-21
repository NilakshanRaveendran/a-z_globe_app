const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// ── Monorepo ───────────────────────────────────────────────────────────────
// Metro only watches the project directory by default, so edits in
// packages/core would never trigger a rebuild. Both node_modules roots are
// listed because npm workspaces hoists most packages to the top level while
// leaving version-conflicting ones nested.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Hierarchical lookup stays ON. npm workspaces does not hoist everything —
// `expo-asset`, for instance, stays nested under `expo/node_modules` because of
// a version conflict — and disabling the walk up makes those unresolvable.
// The usual reason to disable it is to prevent a duplicate React; that is not a
// risk here because react and react-native are both hoisted to the workspace
// root as single copies.
config.resolver.disableHierarchicalLookup = false;

// ── Build output ───────────────────────────────────────────────────────────
// Gradle writes hundreds of thousands of intermediates into android/ and into
// each native module under node_modules. Watching the workspace root means
// Metro crawls every one of them, and a release build running alongside the
// dev server left it hung at "Refreshing…". None of it is JavaScript the app
// imports, so keep it out of the file map entirely.
const escape = (p) => p.replace(/[/\\]/g, '[/\\\\]');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`${escape('/android/')}(app${escape('/')})?(build|\\.cxx|\\.gradle|\\.kotlin)${escape('/')}.*`),
  new RegExp(`${escape('/node_modules/')}.*${escape('/android/')}(build|\\.cxx|\\.gradle)${escape('/')}.*`),
  new RegExp(`${escape('/ios/')}(Pods|build)${escape('/')}.*`),
  new RegExp(`${escape(path.join(workspaceRoot, 'dist'))}${escape('/')}.*`),
];

// ── SVG ────────────────────────────────────────────────────────────────────
// Icons are exported verbatim from Figma (tools/figma-spec.mjs --svg) and
// imported as React components so the app renders the designer's own vectors.
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
