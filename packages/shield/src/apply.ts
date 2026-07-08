import { join, basename } from 'node:path';
import { ADVISORY_LINES, CLAUDE_DENY_RULES, SECRET_IGNORE_PATTERNS } from './constants.js';
import { ensureManagedBlock, hashMarkers, htmlMarkers, type ManagedStatus } from './managed.js';
import { addToStringArray, mergeJsonFile, objectAt, type JsonObject } from './json-file.js';
import {
  appDataPath,
  detectTools,
  type DetectedTool,
  type ShieldEnv,
  type ShieldableToolId,
} from './detect.js';

export interface ShieldOptions {
  /** The project being protected (absolute path). */
  readonly projectRoot: string;
  /** Absolute path to the Guardrails CLI entry (dist/main.cjs) for MCP configs. */
  readonly cliEntry: string;
  readonly env: ShieldEnv;
  /** Shield only these tools. Default: every detected tool. */
  readonly only?: readonly ShieldableToolId[];
}

/** One file we created or edited (or refused to touch). */
export interface ShieldAction {
  readonly path: string;
  readonly status: ManagedStatus | 'created' | 'updated' | 'unchanged' | 'unparseable';
  /** What this action achieves, in plain words. */
  readonly what: string;
}

export type EnforcementLevel = 'blocks-reads' | 'mcp-only' | 'advisory' | 'manual';

export interface ToolShieldResult {
  readonly id: ShieldableToolId;
  readonly name: string;
  /** How strong the protection for this tool is. */
  readonly level: EnforcementLevel;
  readonly actions: readonly ShieldAction[];
  /** A follow-up the user must do by hand, if any. */
  readonly manualStep?: string;
}

export interface ShieldReport {
  readonly detected: readonly DetectedTool[];
  readonly results: readonly ToolShieldResult[];
}

function slug(path: string): string {
  const cleaned = basename(path)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length === 0 ? 'project' : cleaned;
}

function posix(path: string): string {
  return path.replace(/\\/g, '/');
}

function serveArgs(options: ShieldOptions, toolId: string): string[] {
  return [posix(options.cliEntry), 'mcp', 'serve', posix(options.projectRoot), '--tool', toolId];
}

/**
 * Choose the server key inside a *shared* (user-global) MCP config: reuse the
 * entry already pointing at this project, else `guardrails`, else a
 * project-suffixed name so two projects never fight over one entry.
 */
function pickServerKey(servers: JsonObject, projectRoot: string): string {
  const root = posix(projectRoot);
  for (const [key, value] of Object.entries(servers)) {
    if (!key.startsWith('guardrails')) continue;
    const args = (value as { args?: unknown }).args;
    if (Array.isArray(args) && args.includes(root)) return key;
  }
  if (!('guardrails' in servers)) return 'guardrails';
  return `guardrails-${slug(projectRoot)}`;
}

function ignoreFileAction(path: string, tool: string): ShieldAction {
  const status = ensureManagedBlock(path, [...SECRET_IGNORE_PATTERNS]);
  return { path, status, what: `${tool} cannot read the listed secret files` };
}

function advisoryAction(path: string): ShieldAction {
  const status = ensureManagedBlock(path, [...ADVISORY_LINES], htmlMarkers());
  return { path, status, what: 'standing instructions: hands off secrets, use Guardrails' };
}

function mcpJsonAction(
  path: string,
  options: ShieldOptions,
  toolId: string,
  layout: 'mcpServers' | 'vscode',
  shared: boolean,
): ShieldAction {
  const result = mergeJsonFile(path, (config) => {
    const containerKey = layout === 'vscode' ? 'servers' : 'mcpServers';
    const servers = objectAt(config, containerKey);
    const key = shared ? pickServerKey(servers, options.projectRoot) : 'guardrails';
    const body: JsonObject = { command: 'node', args: serveArgs(options, toolId) };
    if (layout === 'vscode') body.type = 'stdio';
    servers[key] = body;
  });
  return {
    path,
    status: result.status,
    what:
      result.status === 'unparseable'
        ? 'could not edit safely (file is not plain JSON) - left untouched'
        : 'Guardrails MCP server registered (redacted reads for secret files)',
  };
}

/** Managed TOML block for Codex's `~/.codex/config.toml`. */
function codexTomlAction(path: string, options: ShieldOptions): ShieldAction {
  const key = `guardrails-${slug(options.projectRoot)}`;
  const args = serveArgs(options, 'codex');
  const body = [
    `[mcp_servers."${key}"]`,
    'command = "node"',
    `args = [${args.map((a) => JSON.stringify(a)).join(', ')}]`,
  ];
  const status = ensureManagedBlock(path, body, hashMarkers(`guardrails:${key}`));
  return { path, status, what: 'Guardrails MCP server registered' };
}

function shieldClaudeCode(options: ShieldOptions): ToolShieldResult {
  const { projectRoot } = options;
  const settingsPath = join(projectRoot, '.claude', 'settings.json');
  const settings = mergeJsonFile(settingsPath, (config) => {
    const permissions = objectAt(config, 'permissions');
    addToStringArray(permissions, 'deny', CLAUDE_DENY_RULES);
  });
  return {
    id: 'claude-code',
    name: 'Claude Code',
    level: settings.status === 'unparseable' ? 'advisory' : 'blocks-reads',
    actions: [
      {
        path: settingsPath,
        status: settings.status,
        what:
          settings.status === 'unparseable'
            ? 'could not edit safely - add the deny rules by hand'
            : 'hard deny rules: its Read tool is blocked for secret files',
      },
      mcpJsonAction(join(projectRoot, '.mcp.json'), options, 'claude-code', 'mcpServers', false),
      advisoryAction(join(projectRoot, 'CLAUDE.md')),
    ],
  };
}

function shieldClaudeDesktop(options: ShieldOptions): ToolShieldResult {
  const dir = appDataPath(options.env, 'Claude');
  const actions: ShieldAction[] = [];
  if (dir !== undefined) {
    actions.push(
      mcpJsonAction(
        join(dir, 'claude_desktop_config.json'),
        options,
        'claude-desktop',
        'mcpServers',
        true,
      ),
    );
  }
  return {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    // Desktop reaches project files only through MCP servers, so registering
    // Guardrails *is* the enforcement: reads come back redacted.
    level: 'mcp-only',
    actions,
    manualStep: 'Fully quit and reopen Claude Desktop once.',
  };
}

function shieldCursor(options: ShieldOptions): ToolShieldResult {
  const { projectRoot } = options;
  return {
    id: 'cursor',
    name: 'Cursor',
    level: 'blocks-reads',
    actions: [
      ignoreFileAction(join(projectRoot, '.cursorignore'), 'Cursor'),
      mcpJsonAction(
        join(projectRoot, '.cursor', 'mcp.json'),
        options,
        'cursor',
        'mcpServers',
        false,
      ),
    ],
  };
}

function shieldWindsurf(options: ShieldOptions): ToolShieldResult {
  const { projectRoot, env } = options;
  return {
    id: 'windsurf',
    name: 'Windsurf',
    level: 'blocks-reads',
    actions: [
      ignoreFileAction(join(projectRoot, '.codeiumignore'), 'Windsurf'),
      mcpJsonAction(
        join(env.homeDir, '.codeium', 'windsurf', 'mcp_config.json'),
        options,
        'windsurf',
        'mcpServers',
        true,
      ),
    ],
  };
}

function shieldAntigravity(options: ShieldOptions): ToolShieldResult {
  return {
    id: 'antigravity',
    name: 'Antigravity',
    level: 'manual',
    actions: [advisoryAction(join(options.projectRoot, 'AGENTS.md'))],
    manualStep:
      'Antigravity has no config file Guardrails can write safely yet - run `guardrails connect antigravity` and paste the snippet into its MCP settings panel.',
  };
}

function shieldGemini(options: ShieldOptions): ToolShieldResult {
  const { projectRoot } = options;
  return {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    level: 'blocks-reads',
    actions: [
      ignoreFileAction(join(projectRoot, '.geminiignore'), 'Gemini'),
      mcpJsonAction(
        join(projectRoot, '.gemini', 'settings.json'),
        options,
        'gemini-cli',
        'mcpServers',
        false,
      ),
    ],
  };
}

function shieldCodex(options: ShieldOptions): ToolShieldResult {
  return {
    id: 'codex',
    name: 'Codex CLI',
    level: 'advisory',
    actions: [
      codexTomlAction(join(options.env.homeDir, '.codex', 'config.toml'), options),
      advisoryAction(join(options.projectRoot, 'AGENTS.md')),
    ],
  };
}

function shieldCopilot(options: ShieldOptions): ToolShieldResult {
  const { projectRoot } = options;
  return {
    id: 'copilot',
    name: 'GitHub Copilot (VS Code)',
    level: 'advisory',
    actions: [
      mcpJsonAction(join(projectRoot, '.vscode', 'mcp.json'), options, 'copilot', 'vscode', false),
      advisoryAction(join(projectRoot, '.github', 'copilot-instructions.md')),
    ],
    manualStep:
      'For hard blocking, a repository admin can add these paths under GitHub → Settings → Copilot → Content exclusion.',
  };
}

const APPLIERS: Record<ShieldableToolId, (options: ShieldOptions) => ToolShieldResult> = {
  'claude-code': shieldClaudeCode,
  'claude-desktop': shieldClaudeDesktop,
  cursor: shieldCursor,
  windsurf: shieldWindsurf,
  antigravity: shieldAntigravity,
  'gemini-cli': shieldGemini,
  codex: shieldCodex,
  copilot: shieldCopilot,
};

/**
 * The one-shot "protect me" operation: detect every AI tool on this machine
 * and write the strongest protection each one supports - hard read-deny rules,
 * AI ignore files, and Guardrails MCP registration - without disturbing any
 * existing user configuration.
 */
export function shieldProject(options: ShieldOptions): ShieldReport {
  const detected = detectTools(options.env, options.projectRoot);
  const wanted =
    options.only === undefined ? detected : detected.filter((t) => options.only?.includes(t.id));
  const results = wanted.map((tool) => APPLIERS[tool.id](options));
  return { detected, results };
}
