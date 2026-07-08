#!/usr/bin/env node
import { run } from './cli.js';

// Avoid top-level await: the published CLI is bundled to CommonJS (see
// scripts/bundle.mjs), which cannot contain a top-level `await`.
void (async () => {
  try {
    process.exitCode = await run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
})();
