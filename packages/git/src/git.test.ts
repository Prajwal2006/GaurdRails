import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { CliGitRepo, execGitRunner, isGitRepository, openGitRepo, type GitRunner } from './git.js';

const execFileAsync = promisify(execFile);

/** A fake runner that returns canned output keyed by the first git subcommand. */
function fakeRunner(responses: Record<string, string>, fail: Set<string> = new Set()): GitRunner {
  return (args) => {
    const key = args.join(' ');
    if (fail.has(key)) return Promise.reject(new Error(`git failed: ${key}`));
    for (const [prefix, value] of Object.entries(responses)) {
      if (key.startsWith(prefix)) return Promise.resolve(value);
    }
    return Promise.reject(new Error(`unexpected git call: ${key}`));
  };
}

describe('CliGitRepo (fake runner)', () => {
  it('parses NUL-delimited staged files', async () => {
    const repo = new CliGitRepo('/repo', fakeRunner({ 'diff --cached': 'a.txt\0b.env\0' }));
    expect(await repo.listStagedFiles()).toEqual(['a.txt', 'b.env']);
  });

  it('reads staged content via git show', async () => {
    const repo = new CliGitRepo('/repo', fakeRunner({ 'show :a.txt': 'hello' }));
    expect(await repo.readStagedContent('a.txt')).toBe('hello');
  });

  it('returns undefined when staged content cannot be read', async () => {
    const repo = new CliGitRepo('/repo', fakeRunner({}, new Set(['show :missing'])));
    expect(await repo.readStagedContent('missing')).toBeUndefined();
  });

  it('lists tracked files', async () => {
    const repo = new CliGitRepo('/repo', fakeRunner({ 'ls-files': 'x\0y\0' }));
    expect(await repo.listTrackedFiles()).toEqual(['x', 'y']);
  });

  it('reads working content from disk, not from the index', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'guardrails-wt-'));
    try {
      await writeFile(join(dir, 'x'), 'on-disk body');
      const repo = new CliGitRepo(dir.replace(/\\/g, '/'), fakeRunner({}));
      expect(await repo.readWorkingContent('x')).toBe('on-disk body');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns undefined when working content cannot be read', async () => {
    const repo = new CliGitRepo('/repo', fakeRunner({}));
    expect(await repo.readWorkingContent('gone')).toBeUndefined();
  });

  it('prefers the absolute hooks path reported by git', async () => {
    const repo = new CliGitRepo(
      '/repo',
      fakeRunner({ 'rev-parse --path-format=absolute --git-path hooks': '/repo/.git/hooks\n' }),
    );
    expect(await repo.hooksDir()).toBe('/repo/.git/hooks');
  });

  it('resolves a relative hooks path against the root', async () => {
    const repo = new CliGitRepo(
      '/repo',
      fakeRunner({ 'rev-parse --git-path hooks': '.git/hooks\n' }),
    );
    expect(await repo.hooksDir()).toBe('/repo/.git/hooks');
  });

  it('keeps an absolute hooks path as-is', async () => {
    const repo = new CliGitRepo(
      '/repo',
      fakeRunner({ 'rev-parse --git-path hooks': '/abs/hooks\n' }),
    );
    expect(await repo.hooksDir()).toBe('/abs/hooks');
  });
});

describe('openGitRepo (fake runner)', () => {
  it('normalizes the repo root', async () => {
    const repo = await openGitRepo('.', fakeRunner({ 'rev-parse --show-toplevel': 'C:\\repo\n' }));
    expect(repo.root).toBe('C:/repo');
  });

  it('throws when not in a repo', async () => {
    await expect(
      openGitRepo('.', fakeRunner({}, new Set(['rev-parse --show-toplevel']))),
    ).rejects.toThrow(/Not a git repository/);
  });

  it('throws on empty toplevel', async () => {
    await expect(
      openGitRepo('.', fakeRunner({ 'rev-parse --show-toplevel': '\n' })),
    ).rejects.toThrow(/Not a git repository/);
  });
});

describe('isGitRepository (fake runner)', () => {
  it('is true inside a work tree', async () => {
    expect(
      await isGitRepository('.', fakeRunner({ 'rev-parse --is-inside-work-tree': 'true\n' })),
    ).toBe(true);
  });

  it('is false when git errors', async () => {
    expect(
      await isGitRepository('.', fakeRunner({}, new Set(['rev-parse --is-inside-work-tree']))),
    ).toBe(false);
  });
});

// Integration: exercise the real `git` binary end-to-end.
describe('real git integration', () => {
  let dir: string;
  let gitAvailable = true;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'guardrails-git-int-'));
    try {
      await execFileAsync('git', ['init'], { cwd: dir });
      await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
      await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: dir });
      await writeFile(join(dir, 'staged.txt'), 'staged body\n');
      await execFileAsync('git', ['add', 'staged.txt'], { cwd: dir });
    } catch {
      gitAvailable = false;
    }
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports the repo, staged files, and content', async () => {
    if (!gitAvailable) return; // git not installed in this environment
    const runner = execGitRunner(dir);
    expect(await isGitRepository(dir, runner)).toBe(true);
    const repo = await openGitRepo(dir, runner);
    expect(await repo.listStagedFiles()).toContain('staged.txt');
    expect(await repo.readStagedContent('staged.txt')).toContain('staged body');
    expect(await repo.listTrackedFiles()).toContain('staged.txt');
    expect((await repo.hooksDir()).length).toBeGreaterThan(0);
  });
});
