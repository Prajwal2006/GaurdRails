import { join } from 'node:path';
import { Guardrails, explainFinding } from '@guardrails/core';
import {
  addToGitignore,
  gitDir,
  installHooks,
  isGitRepo,
  repoRoot,
  uninstallHooks,
  verifyRepo,
  verifyStaged,
  type VerifyResult,
} from '@guardrails/git';
import { compareSeverity, type Finding } from '@guardrails/shared';
import type { IO } from '../io.js';
import { actionLabel, c, heading, icon, severityBadge } from '../ui.js';

async function ensureRepo(io: IO): Promise<string | undefined> {
  const cwd = process.cwd();
  if (!(await isGitRepo(cwd))) {
    io.err(`${icon.cross} Not a git repository. Run this inside a git project.`);
    return undefined;
  }
  return cwd;
}

/** `guardrails git install` */
export async function runGitInstall(io: IO, options: { force?: boolean }): Promise<number> {
  const cwd = await ensureRepo(io);
  if (cwd === undefined) return 2;
  const results = await installHooks(join(await gitDir(cwd), 'hooks'), {
    force: options.force === true,
  });

  io.out(heading('Installing git protection'));
  io.out('');
  let foreign = false;
  for (const r of results) {
    if (r.status === 'skipped-foreign') {
      foreign = true;
      io.out(
        `  ${c.yellow(icon.warn)} ${r.hook}: an existing hook is in place (use --force to replace)`,
      );
    } else {
      io.out(`  ${c.green(icon.check)} ${r.hook}: ${r.status}`);
    }
  }
  io.out('');
  io.out(
    foreign
      ? c.yellow('Some hooks were skipped. Re-run with --force to back up and replace them.')
      : c.green(`${icon.check} Guardrails will now check your commits and pushes.`),
  );
  return 0;
}

/** `guardrails git uninstall` */
export async function runGitUninstall(io: IO): Promise<number> {
  const cwd = await ensureRepo(io);
  if (cwd === undefined) return 2;
  const results = await uninstallHooks(join(await gitDir(cwd), 'hooks'));

  io.out(heading('Removing git protection'));
  io.out('');
  for (const r of results) {
    io.out(`  ${icon.bullet} ${r.hook}: ${r.status}`);
  }
  return 0;
}

function topFinding(result: VerifyResult): Finding | undefined {
  let top: Finding | undefined;
  for (const file of result.files) {
    for (const finding of file.result.findings) {
      if (top === undefined || compareSeverity(finding.severity, top.severity) > 0) top = finding;
    }
  }
  return top;
}

function renderFiles(io: IO, result: VerifyResult): void {
  for (const file of result.files) {
    io.out(`  ${c.cyan(file.path)}`);
    for (const { finding, decision } of file.result.decided) {
      const loc = finding.line ? c.gray(`:${finding.line}`) : '';
      io.out(
        `    ${severityBadge(finding.severity)} ${finding.title}${loc}  ${actionLabel(decision.action)}`,
      );
      io.out(`        ${c.dim(finding.redactedPreview)}`);
    }
  }
}

function renderBlock(io: IO, result: VerifyResult): void {
  io.out(heading('Hold on — we paused this to keep you safe.'));
  io.out('');
  io.out("We found something that looks like a secret in what you're about to share.");
  io.out("That's easy to do by accident, so nothing has left your machine yet.");
  io.out('');
  renderFiles(io, result);
  io.out('');

  const top = topFinding(result);
  if (top !== undefined) {
    const explanation = explainFinding(top);
    io.out(c.bold('Why this matters'));
    io.out(`  ${explanation.why.beginner}`);
    io.out('');
    io.out(c.bold('How to fix it'));
    for (const step of explanation.fix) io.out(`  ${icon.arrow} ${step}`);
    io.out('');
  }
  io.out(
    c.dim(
      'When it is sorted, try again. To override this once (not recommended): use git --no-verify.',
    ),
  );
}

export interface GitVerifyOptions {
  readonly staged?: boolean;
  readonly fix?: boolean;
}

/** `guardrails git verify [--staged] [--fix]` — the hook entry point. */
export async function runGitVerify(io: IO, options: GitVerifyOptions): Promise<number> {
  const cwd = await ensureRepo(io);
  if (cwd === undefined) return 2;
  const root = await repoRoot(cwd);
  const guardrails = new Guardrails();
  const result = options.staged
    ? await verifyStaged(cwd, guardrails)
    : await verifyRepo(root, guardrails);

  if (result.files.length === 0) {
    io.out(
      `${icon.check} ${c.green('No secrets detected.')} (${result.filesScanned} file(s) checked)`,
    );
    return 0;
  }

  if (options.fix === true) {
    const sensitive = [
      ...new Set(
        result.files
          .filter((f) => f.result.findings.some((fd) => fd.category === 'sensitive-file'))
          .map((f) => f.path),
      ),
    ];
    if (sensitive.length > 0) {
      const added = await addToGitignore(root, sensitive);
      if (added.length > 0) {
        io.out(`${c.green(icon.check)} Added to .gitignore: ${added.join(', ')}`);
        io.out(c.dim('If a file was already tracked, run `git rm --cached <file>` too.'));
        io.out('');
      }
    }
  }

  if (!result.blocked) {
    io.out(`${c.yellow(icon.warn)} Found low-risk items only — not blocking.`);
    renderFiles(io, result);
    return 0;
  }

  renderBlock(io, result);
  return 1;
}
