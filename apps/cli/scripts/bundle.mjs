#!/usr/bin/env node
/**
 * Bundle the `guardrails` CLI into a single, self-contained, dependency-free
 * file: `dist/main.cjs`. This is what actually ships to npm - `tsc -b` (run
 * first, see the `build` script) only type-checks and emits into the private
 * `.tsbuild/` directory so the workspace's TS project-reference graph stays
 * intact, without polluting the publishable `dist/`.
 *
 * Bundling (rather than publishing every `@guardrails/*` workspace package to
 * npm) means `npm install -g guardrails` / `npx guardrails` never need to
 * resolve the `workspace:*` protocol or fetch anything beyond this one
 * package - Node builtins are the only imports left unresolved, and esbuild
 * marks those external automatically under `platform: 'node'`.
 */
import { build } from 'esbuild';
import { chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
// CommonJS, not ESM: several bundled dependencies (e.g. commander) use CJS
// `require()` internally, which esbuild cannot safely resolve against Node
// builtins in an ESM output (it would need a synthesized `require` at
// runtime). A `.cjs` bundle sidesteps that entirely - Node treats any `.cjs`
// file as CommonJS regardless of this package's `"type": "module"`.
const outfile = join(root, 'dist', 'main.cjs');

await build({
  entryPoints: [join(root, 'src', 'main.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  // main.ts already starts with `#!/usr/bin/env node` - esbuild detects and
  // preserves a leading shebang from the entry point automatically, so no
  // banner is needed here (adding one too would duplicate it).
  logLevel: 'info',
  logOverride: {
    // Expected: `import.meta.url` is empty in CJS output. The one call site
    // (commands/connect.ts) falls back to the CJS `__filename` global for
    // exactly this reason - see its doc comment.
    'empty-import-meta': 'silent',
  },
});

// `npm`/`pnpm` set the executable bit on `bin` targets at install time, but
// setting it here too means `./dist/main.cjs` and `node --run` work right
// after a local build, without an install step in between.
chmodSync(outfile, 0o755);
