#!/usr/bin/env node
/**
 * Stage a scoped copy of the CLI for publishing to GitHub Packages.
 *
 * GitHub Packages requires npm package names to be scoped to the owning
 * GitHub user/org (`@prajwal2006/...`), which differs from the unscoped
 * `guardrails-cli` name published to npmjs.com. Publishing a repo-scoped
 * package to GitHub Packages is also what makes the package show up under
 * this repository's "Packages" sidebar on GitHub - npmjs.com packages never
 * do, regardless of the `repository` field in package.json.
 *
 * Run `pnpm run build` first so `apps/cli/dist` exists.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cliDir = join(root, 'apps', 'cli');
const stageDir = join(root, '.gpr-stage');

const cliPkg = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8'));

const gprPkg = {
  name: '@prajwal2006/guardrails-cli',
  version: cliPkg.version,
  description: cliPkg.description,
  keywords: cliPkg.keywords,
  license: cliPkg.license,
  author: cliPkg.author,
  homepage: cliPkg.homepage,
  repository: cliPkg.repository,
  bugs: cliPkg.bugs,
  type: cliPkg.type,
  engines: cliPkg.engines,
  bin: cliPkg.bin,
  files: cliPkg.files,
  publishConfig: {
    access: 'public',
    registry: 'https://npm.pkg.github.com',
  },
};

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
cpSync(join(cliDir, 'dist'), join(stageDir, 'dist'), { recursive: true });
cpSync(join(cliDir, 'README.md'), join(stageDir, 'README.md'));
cpSync(join(cliDir, 'LICENSE'), join(stageDir, 'LICENSE'));
writeFileSync(join(stageDir, 'package.json'), JSON.stringify(gprPkg, null, 2) + '\n');

console.log(`Staged ${gprPkg.name}@${gprPkg.version} for GitHub Packages at ${stageDir}`);
