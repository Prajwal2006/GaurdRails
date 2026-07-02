import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isAbsolute, resolve } from 'node:path';

const exec = promisify(execFile);

/** True if `cwd` is inside a git working tree. */
export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await exec('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
    return true;
  } catch {
    return false;
  }
}

/** Absolute path to the repository root (worktree top level). */
export async function repoRoot(cwd: string): Promise<string> {
  const { stdout } = await exec('git', ['rev-parse', '--show-toplevel'], { cwd });
  return stdout.trim();
}

/** Absolute path to the `.git` directory (handles worktrees). */
export async function gitDir(cwd: string): Promise<string> {
  const { stdout } = await exec('git', ['rev-parse', '--git-dir'], { cwd });
  const dir = stdout.trim();
  return isAbsolute(dir) ? dir : resolve(cwd, dir);
}

/** Files staged for commit (added/copied/modified), relative to the repo root. */
export async function stagedFiles(cwd: string): Promise<string[]> {
  const { stdout } = await exec('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
    cwd,
  });
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** The staged (index) content of a file — what would actually be committed. */
export async function readStagedContent(cwd: string, file: string): Promise<string> {
  const { stdout } = await exec('git', ['show', `:${file}`], {
    cwd,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}
