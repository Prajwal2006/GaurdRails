import { Guardrails } from '@guardrails/core';
import {
  applyFixes,
  formatBlockMessage,
  hooksStatus,
  installHooks,
  openGitRepo,
  scanStaged,
  scanTracked,
  suggestFixes,
  uninstallHooks,
  type GitHook,
  type GitRepo,
  type GitScanResult,
} from '@guardrails/git';
import type { IO } from '../io.js';
import { actionLabel, c, heading, icon, severityBadge } from '../ui.js';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function openRepo(io: IO): Promise<GitRepo | undefined> {
  try {
    return await openGitRepo(process.cwd());
  } catch (error) {
    io.err(`${icon.cross} ${errorMessage(error)}`);
    return undefined;
  }
}

/** `guardrails git install` - install pre-commit and pre-push hooks. */
export async function runGitInstall(io: IO): Promise<number> {
  const repo = await openRepo(io);
  if (repo === undefined) return 2;
  const results = installHooks(await repo.hooksDir());
  io.out(heading('Installing git hooks'));
  io.out('');
  for (const r of results) {
    io.out(`  ${c.green(icon.check)} ${r.hook} ${c.gray(`(${r.status})`)}`);
  }
  io.out('');
  io.out(c.dim('Guardrails will now scan staged files before every commit.'));
  return 0;
}

/** `guardrails git uninstall` - remove Guardrails hooks, preserving others. */
export async function runGitUninstall(io: IO): Promise<number> {
  const repo = await openRepo(io);
  if (repo === undefined) return 2;
  const results = uninstallHooks(await repo.hooksDir());
  io.out(heading('Removing git hooks'));
  io.out('');
  for (const r of results) {
    io.out(`  ${icon.bullet} ${r.hook} ${c.gray(`(${r.status})`)}`);
  }
  return 0;
}

/** `guardrails git status` - show hook installation status. */
export async function runGitStatus(io: IO): Promise<number> {
  const repo = await openRepo(io);
  if (repo === undefined) return 2;
  const statuses = hooksStatus(await repo.hooksDir());
  io.out(heading('Git hook status'));
  io.out('');
  for (const s of statuses) {
    const mark = s.managed ? c.green(icon.check) : c.yellow(icon.warn);
    const state = s.managed ? 'installed' : s.exists ? 'present (not managed)' : 'not installed';
    io.out(`  ${mark} ${s.hook} ${c.gray(`- ${state}`)}`);
  }
  return 0;
}

function printFindings(result: GitScanResult, io: IO): void {
  for (const file of result.files) {
    io.out(`  ${c.cyan(file.path)}`);
    for (const { finding, decision } of file.result.decided) {
      const loc = finding.line === undefined ? '' : c.gray(`:${finding.line}`);
      io.out(
        `    ${severityBadge(finding.severity)} ${finding.title}${loc}  ${actionLabel(decision.action)}`,
      );
      io.out(`        ${c.dim(finding.redactedPreview)}`);
    }
  }
}

interface ScanCommandOptions {
  readonly json?: boolean;
}

async function runScan(
  mode: 'staged' | 'tracked',
  options: ScanCommandOptions,
  io: IO,
): Promise<number> {
  const repo = await openRepo(io);
  if (repo === undefined) return 2;
  const guardrails = new Guardrails();
  const result =
    mode === 'staged' ? await scanStaged(repo, guardrails) : await scanTracked(repo, guardrails);

  if (options.json === true) {
    io.out(
      JSON.stringify(
        {
          mode,
          filesScanned: result.filesScanned,
          totalFindings: result.findings.length,
          outcome: result.outcome,
          files: result.files.map((f) => ({ path: f.path, findings: f.result.findings })),
        },
        null,
        2,
      ),
    );
    return result.findings.length > 0 ? 1 : 0;
  }

  const label = mode === 'staged' ? 'staged files' : 'tracked files';
  if (result.findings.length === 0) {
    io.out(
      `${icon.check} ${c.green('No secrets found')} in ${label}. Scanned ${result.filesScanned} file(s).`,
    );
    return 0;
  }
  io.out(heading(`Found ${result.findings.length} potential secret(s) in ${label}:`));
  io.out('');
  printFindings(result, io);
  io.out('');
  for (const fix of suggestFixes(result)) {
    io.out(`  ${icon.arrow} ${c.bold(fix.title)}: ${fix.detail}`);
  }
  return 1;
}

/** `guardrails git scan` - scan the staged changeset. */
export function runGitScan(options: ScanCommandOptions, io: IO): Promise<number> {
  return runScan('staged', options, io);
}

/** `guardrails git check` - scan every tracked file. */
export function runGitCheck(options: ScanCommandOptions, io: IO): Promise<number> {
  return runScan('tracked', options, io);
}

/** `guardrails git fix` - apply safe, reversible fixes (.gitignore, .env.example). */
export async function runGitFix(io: IO): Promise<number> {
  const repo = await openRepo(io);
  if (repo === undefined) return 2;
  const result = await scanTracked(repo, new Guardrails());
  const applied = applyFixes(repo.root, result);
  io.out(heading('Applying fixes'));
  io.out('');
  if (applied.length === 0) {
    io.out(`  ${icon.info} Nothing to fix.`);
    return 0;
  }
  for (const fix of applied) {
    io.out(
      `  ${c.green(icon.check)} ${fix.kind}: ${c.cyan(fix.path)} ${c.gray(`(${fix.detail})`)}`,
    );
  }
  io.out('');
  io.out(c.yellow(`${icon.warn} Remember to rotate any secret that was already committed.`));
  return 0;
}

/**
 * `guardrails git pre-commit` / `pre-push` - the hook entry points. Returns a
 * non-zero code to abort the git operation when secrets are found.
 */
export async function runGitHook(hook: GitHook, io: IO): Promise<number> {
  const repo = await openRepo(io);
  if (repo === undefined) return 0; // don't block when we can't tell
  const guardrails = new Guardrails();
  const result =
    hook === 'pre-commit'
      ? await scanStaged(repo, guardrails)
      : await scanTracked(repo, guardrails);

  const shouldBlock = result.outcome === 'deny' || result.outcome === 'redact';
  if (!shouldBlock) return 0;

  for (const line of formatBlockMessage(result, hook)) io.err(line);
  return 1;
}
