import { installHooks, openGitRepo } from '@guardrails/git';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';
import { initConfig } from '../config.js';

/**
 * `guardrails setup` - the one command a new user runs inside their project.
 * Creates the config, installs the git hooks (when in a git repository), and
 * points at `guardrails connect` for the AI-tool side. Safe to re-run.
 */
export async function runSetup(io: IO): Promise<number> {
  io.out(heading('Setting up Guardrails for this project'));
  io.out('');

  // 1. Config + default policy.
  const { configPath, alreadyExisted } = await initConfig();
  io.out(
    `  ${c.green(icon.check)} Config ${alreadyExisted ? 'found' : 'created'} at ${c.cyan(configPath)}`,
  );

  // 2. Git hooks - protect commits and pushes.
  try {
    const repo = await openGitRepo(process.cwd());
    const results = installHooks(await repo.hooksDir());
    for (const r of results) {
      io.out(`  ${c.green(icon.check)} Git ${r.hook} hook ${r.status}`);
    }
  } catch {
    io.out(
      `  ${c.yellow(icon.warn)} Not a git repository - skipped git hooks. ` +
        c.dim('(run `guardrails git install` later)'),
    );
  }

  io.out('');
  io.out(c.bold('You are protected on the git side. Two optional next steps:'));
  io.out('');
  io.out(`  1. See what is risky right now:   ${c.cyan('guardrails scan')}`);
  io.out(`  2. Shield your AI tool:           ${c.cyan('guardrails connect')}`);
  io.out('');
  io.out(c.dim('Guardrails runs 100% on your machine. Nothing is ever uploaded.'));
  return 0;
}
