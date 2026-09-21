Raw harvested icons that no screen references yet.

They came out of `tools/harvest-icons.mjs`, which names each export from its
surrounding Figma context — so the names here are descriptive of where the glyph
was found, not what it is. When a screen needs one, rename it to its semantic
name, move it up into `../app/`, and register it in `src/core/ui/icons.tsx`.

Run `node tools/normalize-svg.mjs assets/icons` after any new export.
