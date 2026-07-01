#!/usr/bin/env node
import { run } from './cli.js';

try {
  process.exitCode = await run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
