import { relative } from 'node:path';
import { installHooks, openGitRepo } from '@guardrails/git';
import {
  defaultShieldEnv,
  shieldProject,
  type EnforcementLevel,
  type ShieldReport,
  type ToolShieldResult,
} from '@guardrails/shield';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';
import { initConfig, loadConfig, saveConfig } from '../config.js';
import { cliEntryPath } from './connect.js';

const LEVEL_LABEL: Record<EnforcementLevel, string> = {
  'blocks-reads': 'secret files: reading blocked',
  'mcp-only': 'reads files only through Guardrails',
  advisory: 'instructed to use Guardrails (no hard block available)',
  manual: 'one manual step needed',
};

function levelBadge(level: EnforcementLevel): string {
  const label = LEVEL_LABEL[level];
  return level === 'blocks-reads' || level === 'mcp-only'
    ? c.green(`[${label}]`)
    : c.yellow(`[${label}]`);
}

function friendlyPath(root: string, path: string): string {
  const rel = relative(root, path);
  return rel.startsWith('..') ? path : rel.replace(/\\/g, '/');
}

function printToolResult(result: ToolShieldResult, root: string, io: IO): void {
  io.out(`  ${c.green(icon.check)} ${c.bold(result.name.padEnd(26))} ${levelBadge(result.level)}`);
  for (const action of result.actions) {
    const path = friendlyPath(root, action.path);
    if (action.status === 'unparseable') {
      io.out(`      ${c.yellow(icon.warn)} ${c.cyan(path)} - ${action.what}`);
    } else if (action.status === 'unchanged') {
      io.out(`      ${icon.bullet} ${c.cyan(path)} ${c.gray('- already protected')}`);
    } else {
      io.out(`      ${icon.bullet} ${c.cyan(path)} ${c.gray(`- ${action.what}`)}`);
    }
  }
  if (result.manualStep !== undefined) {
    io.out(`      ${c.yellow(icon.arrow)} ${result.manualStep}`);
  }
}

/** Print a shield report. Shared by `setup`. */
export function printShieldReport(report: ShieldReport, root: string, io: IO): void {
  if (report.detected.length === 0) {
    io.out(`  ${icon.info} No AI coding tools found on this machine yet.`);
    io.out(c.dim('    When you install one, run `guardrails setup` again.'));
    return;
  }
  for (const result of report.results) printToolResult(result, root, io);
}

/**
 * `guardrails setup` - the ONE command a user runs inside their project.
 * Creates the config, installs git hooks, then detects every AI tool on the
 * machine and writes the strongest protection each supports: hard read-deny
 * rules, AI ignore files, and Guardrails MCP registration. Safe to re-run
 * any time (e.g. after installing a new AI tool).
 */
export async function runSetup(io: IO): Promise<number> {
  const root = process.cwd();
  io.out(heading('Setting up Guardrails for this project'));
  io.out('');

  // 1. Config + default policy.
  const { configPath, alreadyExisted } = await initConfig();
  io.out(
    `  ${c.green(icon.check)} Config ${alreadyExisted ? 'found' : 'created'} at ${c.cyan(friendlyPath(root, configPath))}`,
  );

  // 2. Git hooks - protect commits and pushes.
  try {
    const repo = await openGitRepo(root);
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

  // 3. Shield every AI tool on this machine - no manual JSON editing.
  io.out('');
  const report = shieldProject({
    projectRoot: root,
    cliEntry: cliEntryPath(),
    env: defaultShieldEnv(),
  });
  io.out(
    c.bold(
      `Found ${report.detected.length} AI tool${report.detected.length === 1 ? '' : 's'} on this computer. Shielding:`,
    ),
  );
  io.out('');
  printShieldReport(report, root, io);

  // Remember what we shielded so the git hook can flag new arrivals.
  const { config } = await loadConfig(root);
  await saveConfig({ ...config, shieldedTools: report.results.map((r) => r.id) }, root);

  io.out('');
  io.out(c.bold('Done. Restart your AI tools once so they pick up the new config.'));
  io.out('');
  io.out(`  ${icon.arrow} See what was risky:        ${c.cyan('guardrails scan')}`);
  io.out(`  ${icon.arrow} Watch AI access decisions: ${c.cyan('guardrails audit')}`);
  io.out(
    `  ${icon.arrow} Installed a new AI tool?   ${c.cyan('guardrails setup')} ${c.gray('(just run it again)')}`,
  );
  io.out('');
  io.out(c.dim('Guardrails runs 100% on your machine. Nothing is ever uploaded.'));
  return 0;
}
