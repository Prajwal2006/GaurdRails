import { Command } from 'commander';
import { EXPERIENCE_LEVELS, type ExperienceLevel } from '@guardrails/shared';
import { consoleIO, type IO } from './io.js';
import { loadConfig } from './config.js';
import { runScan } from './commands/scan.js';
import { runExplain } from './commands/explain.js';
import { runDoctor } from './commands/doctor.js';
import { runStatus } from './commands/status.js';
import { runInit } from './commands/init.js';
import { runReport, type ReportFormat } from './commands/report.js';
import { runConfig, runPolicies } from './commands/policies.js';
import { runGitInstall, runGitUninstall, runGitVerify } from './commands/git.js';

function toLevel(value: string | undefined, fallback: ExperienceLevel): ExperienceLevel {
  return value !== undefined && (EXPERIENCE_LEVELS as readonly string[]).includes(value)
    ? (value as ExperienceLevel)
    : fallback;
}

/**
 * Build and run the CLI. Returns the intended process exit code rather than
 * calling process.exit, so it is safe to drive from tests.
 */
export async function run(argv: readonly string[], io: IO = consoleIO): Promise<number> {
  const program = new Command();
  let exitCode = 0;

  program
    .name('guardrails')
    .description(
      '🛡️  Guardrails — keep secrets away from AI coding assistants. Local-only, privacy-first.',
    )
    .version('0.1.0');

  program
    .command('scan [paths...]')
    .alias('secrets')
    .description('Scan files or directories for secrets')
    .option('--json', 'output results as JSON')
    .action(async (paths: string[], opts: { json?: boolean }) => {
      exitCode = await runScan(paths, { json: opts.json === true }, io);
    });

  program
    .command('explain [type]')
    .description('Explain a secret type and how to fix it')
    .option('-l, --level <level>', 'experience level: beginner | intermediate | professional')
    .action(async (type: string | undefined, opts: { level?: string }) => {
      const { config } = await loadConfig();
      exitCode = runExplain(type, toLevel(opts.level, config.experienceLevel), io);
    });

  program
    .command('report [paths...]')
    .description('Generate a security report (Markdown or JSON)')
    .option('-f, --format <format>', 'output format: md | json', 'md')
    .option('-o, --output <file>', 'write the report to a file instead of stdout')
    .action(async (paths: string[], opts: { format?: string; output?: string }) => {
      const format: ReportFormat = opts.format === 'json' ? 'json' : 'md';
      exitCode = await runReport(
        paths,
        opts.output === undefined ? { format } : { format, output: opts.output },
        io,
      );
    });

  program
    .command('doctor')
    .description('Check that your environment is ready')
    .action(async () => {
      exitCode = await runDoctor(io);
    });

  program
    .command('status')
    .description('Show the current configuration')
    .action(async () => {
      exitCode = await runStatus(io);
    });

  program
    .command('init')
    .description('Create .guardrails config and a default policy')
    .action(async () => {
      exitCode = await runInit(io);
    });

  program
    .command('policies')
    .description('List policies and their rules')
    .action(async () => {
      exitCode = await runPolicies(io);
    });

  program
    .command('config')
    .description('Print the effective configuration')
    .action(async () => {
      exitCode = await runConfig(io);
    });

  const git = program.command('git').description('Git protection: install hooks and scan commits');
  git
    .command('install')
    .description('Install pre-commit and pre-push hooks')
    .option('--force', 'back up and replace existing foreign hooks')
    .action(async (opts: { force?: boolean }) => {
      exitCode = await runGitInstall(io, { force: opts.force === true });
    });
  git
    .command('uninstall')
    .description('Remove the Guardrails git hooks')
    .action(async () => {
      exitCode = await runGitUninstall(io);
    });
  git
    .command('verify')
    .description('Scan for secrets (used by the hooks)')
    .option('--staged', 'scan only staged content (pre-commit)')
    .option('--fix', 'add flagged sensitive files to .gitignore')
    .action(async (opts: { staged?: boolean; fix?: boolean }) => {
      exitCode = await runGitVerify(io, { staged: opts.staged === true, fix: opts.fix === true });
    });

  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => io.out(str.replace(/\n$/, '')),
    writeErr: (str) => io.err(str.replace(/\n$/, '')),
  });

  try {
    await program.parseAsync([...argv], { from: 'user' });
  } catch (error) {
    const err = error as { code?: string; exitCode?: number };
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.help' ||
      err.code === 'commander.version'
    ) {
      return 0;
    }
    return typeof err.exitCode === 'number' ? err.exitCode : 1;
  }
  return exitCode;
}
