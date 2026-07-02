/**
 * Installs (or removes, with --remove) a global `guardrails` command by writing
 * small launcher shims into npm's global bin directory - the one place that is
 * already on PATH on every machine with Node.js installed. No PATH editing, no
 * `pnpm setup`, no admin rights on a default Node install.
 *
 *   node scripts/install-global.mjs            # install
 *   node scripts/install-global.mjs --remove   # uninstall
 */
import { execSync } from 'node:child_process';
import { chmodSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'apps', 'cli', 'dist', 'main.js');
const remove = process.argv.includes('--remove');

function npmGlobalBinDir() {
  const prefix = execSync('npm prefix -g', { encoding: 'utf8' }).trim();
  // On Windows the shims live directly in the prefix; elsewhere in prefix/bin.
  return process.platform === 'win32' ? prefix : join(prefix, 'bin');
}

const binDir = npmGlobalBinDir();
const shShim = join(binDir, 'guardrails'); // sh - used by Git Bash, macOS, Linux
const cmdShim = join(binDir, 'guardrails.cmd'); // cmd/PowerShell on Windows

if (remove) {
  for (const file of [shShim, cmdShim]) {
    if (existsSync(file)) rmSync(file);
  }
  console.log('Removed the global `guardrails` command.');
  process.exit(0);
}

if (!existsSync(entry)) {
  console.error('Build the CLI first: run `pnpm build` in the repository root.');
  process.exit(1);
}

const posixEntry = entry.replace(/\\/g, '/');
try {
  writeFileSync(shShim, `#!/bin/sh\nexec node "${posixEntry}" "$@"\n`);
  try {
    chmodSync(shShim, 0o755);
  } catch {
    /* chmod is a no-op on Windows */
  }
  if (process.platform === 'win32') {
    writeFileSync(cmdShim, `@ECHO OFF\r\nnode "${entry}" %*\r\n`);
  }
} catch (error) {
  const code = /** @type {{ code?: string }} */ (error).code;
  if (code === 'EACCES' || code === 'EPERM') {
    console.error(`No permission to write to ${binDir}.`);
    console.error('Re-run with elevated rights (e.g. `sudo node scripts/install-global.mjs`).');
    process.exit(1);
  }
  throw error;
}

console.log('Installed the global `guardrails` command.');
console.log(`  launcher : ${process.platform === 'win32' ? cmdShim : shShim}`);
console.log(`  runs     : node ${entry}`);
console.log('Try it: open a new terminal and run `guardrails --help`');
