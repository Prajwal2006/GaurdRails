import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';

/** Forward-slash form of a path - valid on every OS and safe inside JSON. */
function slashes(path: string): string {
  return path.replace(/\\/g, '/');
}

/** Absolute path to the built CLI entry point (dist/main.js). */
export function cliEntryPath(): string {
  return slashes(fileURLToPath(new URL('../main.js', import.meta.url)));
}

function serveArgs(root: string, tool: string): string[] {
  return [cliEntryPath(), 'mcp', 'serve', root, '--tool', tool];
}

/** The `{ command, args }` JSON body shared by most MCP client configs. */
function serverJson(root: string, tool: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify(
    { mcpServers: { guardrails: { ...extra, command: 'node', args: serveArgs(root, tool) } } },
    null,
    2,
  );
}

interface ToolGuide {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  render(root: string): string[];
}

const GUIDES: readonly ToolGuide[] = [
  {
    id: 'claude-code',
    name: 'Claude Code (CLI / VS Code extension)',
    aliases: ['claude', 'claudecode'],
    render(root) {
      const args = serveArgs(root, 'claude-code');
      return [
        'Run this one command inside your project:',
        '',
        `  claude mcp add guardrails -- node ${args.join(' ')}`,
        '',
        'Then restart Claude Code. Check it worked with: claude mcp list',
        '',
        'Extra shield (recommended): Claude Code can also read files on its own,',
        'so tell it to keep away from secrets. Add this line to your CLAUDE.md:',
        '',
        '  Never read .env or key files directly - use the guardrails MCP tools instead.',
      ];
    },
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop (app)',
    aliases: ['desktop', 'claudedesktop'],
    render(root) {
      return [
        'Open the config file (create it if missing):',
        '  Windows:  %APPDATA%\\Claude\\claude_desktop_config.json',
        '  macOS:    ~/Library/Application Support/Claude/claude_desktop_config.json',
        '',
        'Add this (merge into the file if it already has content):',
        '',
        ...serverJson(root, 'claude-desktop').split('\n'),
        '',
        'Save, then fully quit and reopen Claude Desktop.',
      ];
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    aliases: [],
    render(root) {
      return [
        `Create the file ${slashes(root)}/.cursor/mcp.json with:`,
        '',
        ...serverJson(root, 'cursor').split('\n'),
        '',
        'Then restart Cursor and approve the "guardrails" server when asked.',
      ];
    },
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    aliases: [],
    render(root) {
      return [
        'Open ~/.codeium/windsurf/mcp_config.json (or Windsurf Settings → MCP) and add:',
        '',
        ...serverJson(root, 'windsurf').split('\n'),
        '',
        'Then restart Windsurf.',
      ];
    },
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    aliases: [],
    render(root) {
      return [
        'In Antigravity, open the agent panel → MCP settings (Manage MCP servers) and add:',
        '',
        ...serverJson(root, 'antigravity').split('\n'),
        '',
        'Then reload the MCP servers.',
      ];
    },
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    aliases: ['gemini'],
    render(root) {
      return [
        `Add this to ${slashes(root)}/.gemini/settings.json (project) or ~/.gemini/settings.json (global):`,
        '',
        ...serverJson(root, 'gemini-cli').split('\n'),
        '',
        'Then restart gemini. Check it worked with: /mcp',
      ];
    },
  },
  {
    id: 'codex',
    name: 'Codex CLI (OpenAI)',
    aliases: ['openai'],
    render(root) {
      const args = serveArgs(root, 'codex');
      return [
        'Add this to ~/.codex/config.toml:',
        '',
        '  [mcp_servers.guardrails]',
        '  command = "node"',
        `  args = [${args.map((a) => JSON.stringify(a)).join(', ')}]`,
        '',
        'Then restart codex.',
      ];
    },
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot (VS Code)',
    aliases: ['vscode', 'github-copilot'],
    render(root) {
      const body = JSON.stringify(
        {
          servers: {
            guardrails: { type: 'stdio', command: 'node', args: serveArgs(root, 'copilot') },
          },
        },
        null,
        2,
      );
      return [
        `Create the file ${slashes(root)}/.vscode/mcp.json with:`,
        '',
        ...body.split('\n'),
        '',
        'Then open Copilot Chat in Agent mode and click "Start" on the guardrails server.',
      ];
    },
  },
];

function findGuide(term: string): ToolGuide | undefined {
  const key = term.trim().toLowerCase().replace(/[\s_]/g, '-');
  return GUIDES.find((g) => g.id === key || g.aliases.includes(key.replace(/-/g, '')));
}

export interface ConnectOptions {
  readonly root?: string;
}

/**
 * `guardrails connect [tool]` - print ready-to-paste MCP configuration for an
 * AI tool, with this machine's absolute paths already filled in. With no tool,
 * lists everything we know how to connect.
 */
export function runConnect(tool: string | undefined, options: ConnectOptions, io: IO): number {
  const root = slashes(resolve(options.root ?? process.cwd()));

  if (tool === undefined || tool.trim().length === 0) {
    io.out(heading('Connect your AI tool to Guardrails'));
    io.out('');
    io.out('Pick your tool and run the matching command:');
    io.out('');
    for (const guide of GUIDES) {
      io.out(`  guardrails connect ${guide.id.padEnd(16)} ${c.gray(guide.name)}`);
    }
    io.out('');
    io.out(c.dim('Each prints copy-paste config with the right paths already filled in.'));
    return 0;
  }

  const guide = findGuide(tool);
  if (guide === undefined) {
    io.err(`${icon.cross} Unknown tool "${tool}". Run \`guardrails connect\` to see the list.`);
    return 2;
  }

  io.out(heading(`Connect ${guide.name}`));
  io.out('');
  io.out(c.dim(`Protecting project: ${root}`));
  io.out('');
  for (const line of guide.render(root)) io.out(line);
  io.out('');
  io.out(c.dim('Test it: ask your AI to read .env - it should get <REDACTED> placeholders.'));
  return 0;
}

/** Every tool id `connect` understands (used by `setup` and tests). */
export function connectableTools(): readonly string[] {
  return GUIDES.map((g) => g.id);
}
