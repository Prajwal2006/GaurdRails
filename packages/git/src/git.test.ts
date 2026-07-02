import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { addToGitignore } from './gitignore.js';
import { HOOK_MARKER, installHooks, uninstallHooks } from './hooks.js';
import { gitDir, isGitRepo, stagedFiles } from './git-io.js';
import { verifyStaged } from './verify.js';

const OPENAI = 'sk-' + 'a'.repeat(40);
let repo: string;

function git(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'guardrails-git-'));
  git(['init'], repo);
  git(['config', 'user.email', 'test@example.com'], repo);
  git(['config', 'user.name', 'Test'], repo);
  await writeFile(join(repo, '.env'), `OPENAI_API_KEY=${OPENAI}\n`);
  await writeFile(join(repo, 'app.ts'), 'export const x = 1;\n');
  git(['add', '.'], repo);
});

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('git-io', () => {
  it('detects a git repository and lists staged files', async () => {
    expect(await isGitRepo(repo)).toBe(true);
    const staged = await stagedFiles(repo);
    expect(staged).toContain('.env');
    expect(staged).toContain('app.ts');
  });

  it('reports non-repos', async () => {
    const notRepo = await mkdtemp(join(tmpdir(), 'guardrails-notrepo-'));
    expect(await isGitRepo(notRepo)).toBe(false);
    await rm(notRepo, { recursive: true, force: true });
  });
});

describe('verifyStaged', () => {
  it('blocks a commit that stages a secret', async () => {
    const result = await verifyStaged(repo);
    expect(result.blocked).toBe(true);
    expect(result.files.map((f) => f.path)).toContain('.env');
  });
});

describe('hooks', () => {
  it('installs, is idempotent, and uninstalls', async () => {
    const hooksDir = join(await gitDir(repo), 'hooks');

    const created = await installHooks(hooksDir);
    expect(created.every((r) => r.status === 'created' || r.status === 'updated')).toBe(true);
    const preCommit = await readFile(join(hooksDir, 'pre-commit'), 'utf8');
    expect(preCommit).toContain(HOOK_MARKER);

    const again = await installHooks(hooksDir);
    expect(again.every((r) => r.status === 'updated')).toBe(true);

    const removed = await uninstallHooks(hooksDir);
    expect(removed.every((r) => r.status === 'removed')).toBe(true);
    expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(false);
  });

  it('does not clobber a foreign hook unless forced, and restores it', async () => {
    const hooksDir = join(await gitDir(repo), 'hooks');
    const preCommit = join(hooksDir, 'pre-commit');
    await writeFile(preCommit, '#!/bin/sh\necho custom\n');

    const skipped = await installHooks(hooksDir);
    expect(skipped.find((r) => r.hook === 'pre-commit')?.status).toBe('skipped-foreign');
    expect(await readFile(preCommit, 'utf8')).toContain('echo custom');

    const forced = await installHooks(hooksDir, { force: true });
    expect(forced.find((r) => r.hook === 'pre-commit')?.status).toBe('backed-up');
    expect(existsSync(`${preCommit}.pre-guardrails`)).toBe(true);

    const restored = await uninstallHooks(hooksDir);
    expect(restored.find((r) => r.hook === 'pre-commit')?.status).toBe('restored');
    expect(await readFile(preCommit, 'utf8')).toContain('echo custom');
    // cleanup for other tests
    await rm(preCommit, { force: true });
  });
});

describe('addToGitignore', () => {
  it('appends new patterns and skips existing ones', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'guardrails-ignore-'));
    await writeFile(join(dir, '.gitignore'), 'node_modules\n');

    const added = await addToGitignore(dir, ['.env', 'node_modules', '*.pem']);
    expect(added).toEqual(['.env', '*.pem']);

    const contents = await readFile(join(dir, '.gitignore'), 'utf8');
    expect(contents).toContain('.env');
    expect(contents).toContain('*.pem');

    const again = await addToGitignore(dir, ['.env']);
    expect(again).toEqual([]);

    await rm(dir, { recursive: true, force: true });
  });
});
