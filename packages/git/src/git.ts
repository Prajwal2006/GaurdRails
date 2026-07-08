import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * A minimal git command runner. Isolating git behind this function keeps the
 * repository logic pure and testable - tests inject a fake runner, production
 * uses the real `git` binary. Args are always passed as an array (never a
 * shell string) so no user value is ever interpolated into a command line.
 */
export type GitRunner = (args: readonly string[]) => Promise<string>;

/** Build a runner that shells out to the real `git` binary in `cwd`. */
export function execGitRunner(cwd: string): GitRunner {
  return async (args) => {
    const { stdout } = await execFileAsync('git', [...args], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  };
}

/** A read-only view of a git repository, scoped to the checks Guardrails needs. */
export interface GitRepo {
  /** Absolute repository root (top level), with forward slashes. */
  readonly root: string;
  /** Directory git stores hooks in (honours `core.hooksPath`). */
  hooksDir(): Promise<string>;
  /** Paths (repo-relative) that are staged for commit: added/copied/modified/renamed. */
  listStagedFiles(): Promise<string[]>;
  /** The staged (index) content of a path, or undefined if it can't be read. */
  readStagedContent(path: string): Promise<string | undefined>;
  /** All tracked paths (repo-relative). */
  listTrackedFiles(): Promise<string[]>;
  /** The working-tree content of a path, or undefined if it can't be read. */
  readWorkingContent(path: string): Promise<string | undefined>;
}

function splitNul(output: string): string[] {
  return output.split('\0').filter((entry) => entry.length > 0);
}

/** A `GitRepo` backed by a `GitRunner`. */
export class CliGitRepo implements GitRepo {
  constructor(
    readonly root: string,
    private readonly run: GitRunner,
  ) {}

  async hooksDir(): Promise<string> {
    // A relative `--git-path` result is relative to the *runner's cwd*, which
    // may be a subdirectory of the repo - so ask git for an absolute path.
    // Fall back for git < 2.31 (no --path-format), resolving against the root.
    let path: string;
    try {
      path = (
        await this.run(['rev-parse', '--path-format=absolute', '--git-path', 'hooks'])
      ).trim();
    } catch {
      path = (await this.run(['rev-parse', '--git-path', 'hooks'])).trim();
    }
    return path.startsWith('/') || /^[A-Za-z]:/.test(path) ? path : `${this.root}/${path}`;
  }

  async listStagedFiles(): Promise<string[]> {
    const out = await this.run(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
    return splitNul(out);
  }

  async readStagedContent(path: string): Promise<string | undefined> {
    try {
      return await this.run(['show', `:${path}`]);
    } catch {
      return undefined;
    }
  }

  async listTrackedFiles(): Promise<string[]> {
    return splitNul(await this.run(['ls-files', '-z']));
  }

  async readWorkingContent(path: string): Promise<string | undefined> {
    // Read from disk: `git show :0:<path>` would return the *index* content
    // (same as readStagedContent), not what is actually in the working tree.
    try {
      return await readFile(join(this.root, path), 'utf8');
    } catch {
      return undefined;
    }
  }
}

/** True when `cwd` is inside a git working tree. */
export async function isGitRepository(cwd: string, runner?: GitRunner): Promise<boolean> {
  const run = runner ?? execGitRunner(cwd);
  try {
    return (await run(['rev-parse', '--is-inside-work-tree'])).trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Open the git repository containing `cwd`. Rejects if `cwd` is not inside a
 * repository. Pass a custom `runner` in tests.
 */
export async function openGitRepo(
  cwd: string = process.cwd(),
  runner?: GitRunner,
): Promise<GitRepo> {
  const run = runner ?? execGitRunner(cwd);
  let root: string;
  try {
    root = (await run(['rev-parse', '--show-toplevel'])).trim();
  } catch {
    throw new Error(`Not a git repository (or git is unavailable): ${cwd}`);
  }
  if (root.length === 0) throw new Error(`Not a git repository: ${cwd}`);
  return new CliGitRepo(root.replace(/\\/g, '/'), run);
}
