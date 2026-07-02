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
import {
  runGitCheck,
  runGitFix,
  runGitHook,
  runGitInstall,
  runGitScan,
  runGitStatus,
  runGitUninstall,
} from './commands/git.js';
import { runMcpInfo, runMcpServe } from './commands/mcp.js';
import { runAdapters } from './commands/adapters.js';
import { runAudit } from './commands/audit.js';
import { runSetup } from './commands/setup.js';
import { runConnect } from './commands/connect.js';

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
      '🛡️  Guardrails - keep secrets away from AI coding assistants. Local-only, privacy-first.',
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
    .command('setup')
    .description('One-time project setup: config + git hooks, with next steps')
    .action(async () => {
      exitCode = await runSetup(io);
    });

  program
    .command('connect [tool]')
    .description('Show copy-paste config to connect an AI tool (Claude, Gemini, Codex, …)')
    .option('-r, --root <dir>', 'project directory to protect (defaults to the current one)')
    .action((tool: string | undefined, opts: { root?: string }) => {
      exitCode = runConnect(tool, opts.root === undefined ? {} : { root: opts.root }, io);
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

  const git = program.command('git').description('Git protection: scan staged files, manage hooks');

  git
    .command('install')
    .description('Install pre-commit and pre-push hooks')
    .action(async () => {
      exitCode = await runGitInstall(io);
    });

  git
    .command('uninstall')
    .description('Remove Guardrails hooks (preserves other hook content)')
    .action(async () => {
      exitCode = await runGitUninstall(io);
    });

  git
    .command('status')
    .description('Show hook installation status')
    .action(async () => {
      exitCode = await runGitStatus(io);
    });

  git
    .command('scan')
    .description('Scan the staged changeset for secrets')
    .option('--json', 'output results as JSON')
    .action(async (opts: { json?: boolean }) => {
      exitCode = await runGitScan({ json: opts.json === true }, io);
    });

  git
    .command('check')
    .description('Scan every tracked file for secrets')
    .option('--json', 'output results as JSON')
    .action(async (opts: { json?: boolean }) => {
      exitCode = await runGitCheck({ json: opts.json === true }, io);
    });

  git
    .command('fix')
    .description('Apply safe fixes (.gitignore, .env.example)')
    .action(async () => {
      exitCode = await runGitFix(io);
    });

  git
    .command('pre-commit')
    .description('Hook entry point: scan staged files, blocking on secrets')
    .action(async () => {
      exitCode = await runGitHook('pre-commit', io);
    });

  git
    .command('pre-push')
    .description('Hook entry point: scan tracked files, blocking on secrets')
    .action(async () => {
      exitCode = await runGitHook('pre-push', io);
    });

  const mcp = program.command('mcp').description('Model Context Protocol server for AI tools');

  mcp
    .command('serve [root]')
    .description('Run the MCP server on stdio, serving an (optionally) chosen root')
    .option('--allow <globs...>', 'globs that are always allowed')
    .option('--deny <globs...>', 'globs that are always denied')
    .option('--tool <id>', 'attribute requests to this tool id')
    .option('--no-audit', 'do not write an audit log')
    .option('--withhold', 'strict mode: withhold sensitive files instead of redacting them')
    .action(
      async (
        root: string | undefined,
        opts: {
          allow?: string[];
          deny?: string[];
          tool?: string;
          audit?: boolean;
          withhold?: boolean;
        },
      ) => {
        exitCode = await runMcpServe(
          {
            ...(root !== undefined ? { root } : {}),
            ...(opts.allow !== undefined ? { allow: opts.allow } : {}),
            ...(opts.deny !== undefined ? { deny: opts.deny } : {}),
            ...(opts.tool !== undefined ? { tool: opts.tool } : {}),
            ...(opts.audit === false ? { noAudit: true } : {}),
            ...(opts.withhold === true ? { withhold: true } : {}),
          },
          io,
        );
      },
    );

  mcp
    .command('info')
    .description('Describe the MCP server without starting it')
    .action(() => {
      exitCode = runMcpInfo(io);
    });

  program
    .command('adapters')
    .description('List the AI tools Guardrails can mediate')
    .action(() => {
      exitCode = runAdapters(io);
    });

  program
    .command('audit')
    .description('Show the value-free audit log')
    .option('-n, --limit <count>', 'show at most this many recent events')
    .option('--json', 'output events as JSON')
    .option('-f, --file <path>', 'read from a specific audit file')
    .action((opts: { limit?: string; json?: boolean; file?: string }) => {
      const limit = opts.limit === undefined ? undefined : Number.parseInt(opts.limit, 10);
      exitCode = runAudit(
        {
          ...(limit !== undefined && !Number.isNaN(limit) ? { limit } : {}),
          ...(opts.json === true ? { json: true } : {}),
          ...(opts.file !== undefined ? { file: opts.file } : {}),
        },
        io,
      );
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
