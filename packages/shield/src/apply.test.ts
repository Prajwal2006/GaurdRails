import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { shieldProject, type ShieldOptions } from './apply.js';
import type { ShieldEnv } from './detect.js';

let home: string;
let project: string;
let appData: string;

function options(): ShieldOptions {
  const env: ShieldEnv = { platform: 'win32', homeDir: home, appDataDir: appData };
  return { projectRoot: project, cliEntry: 'C:\\gr\\apps\\cli\\dist\\main.js', env };
}

function json(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'guardrails-shome-'));
  project = mkdtempSync(join(tmpdir(), 'guardrails-sproj-'));
  appData = join(home, 'AppData', 'Roaming');
  mkdirSync(appData, { recursive: true });
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

describe('shieldProject', () => {
  it('shields nothing when no tools are detected', () => {
    const report = shieldProject(options());
    expect(report.detected).toEqual([]);
    expect(report.results).toEqual([]);
  });

  it('writes hard deny rules and MCP config for Claude Code', () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    const report = shieldProject(options());

    const claude = report.results.find((r) => r.id === 'claude-code');
    expect(claude?.level).toBe('blocks-reads');

    const settings = json(join(project, '.claude', 'settings.json')) as {
      permissions: { deny: string[] };
    };
    expect(settings.permissions.deny).toContain('Read(./.env)');
    expect(settings.permissions.deny).toContain('Read(**/*.pem)');

    const mcp = json(join(project, '.mcp.json')) as {
      mcpServers: { guardrails: { command: string; args: string[] } };
    };
    expect(mcp.mcpServers.guardrails.command).toBe('node');
    expect(mcp.mcpServers.guardrails.args).toContain('serve');

    expect(readFileSync(join(project, 'CLAUDE.md'), 'utf8')).toContain('Guardrails');
  });

  it('preserves existing Claude settings and is idempotent', () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    mkdirSync(join(project, '.claude'), { recursive: true });
    writeFileSync(
      join(project, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { deny: ['WebFetch'], allow: ['Bash(ls:*)'] } }, null, 2),
    );

    shieldProject(options());
    const first = readFileSync(join(project, '.claude', 'settings.json'), 'utf8');
    shieldProject(options());
    const second = readFileSync(join(project, '.claude', 'settings.json'), 'utf8');

    expect(second).toBe(first);
    const settings = JSON.parse(second) as { permissions: { deny: string[]; allow: string[] } };
    expect(settings.permissions.deny).toContain('WebFetch');
    expect(settings.permissions.deny).toContain('Read(./.env)');
    expect(settings.permissions.allow).toEqual(['Bash(ls:*)']);
  });

  it('writes ignore files for Cursor, Windsurf, and Gemini', () => {
    mkdirSync(join(home, '.cursor'), { recursive: true });
    mkdirSync(join(home, '.codeium', 'windsurf'), { recursive: true });
    mkdirSync(join(home, '.gemini'), { recursive: true });

    const report = shieldProject(options());
    const levels = new Map(report.results.map((r) => [r.id, r.level]));
    expect(levels.get('cursor')).toBe('blocks-reads');
    expect(levels.get('windsurf')).toBe('blocks-reads');
    expect(levels.get('gemini-cli')).toBe('blocks-reads');

    for (const file of ['.cursorignore', '.codeiumignore', '.geminiignore']) {
      const content = readFileSync(join(project, file), 'utf8');
      expect(content).toContain('.env');
      expect(content).toContain('!.env.example');
      expect(content).toContain('*.pem');
    }

    // Windsurf's MCP config is user-global.
    const windsurfMcp = json(join(home, '.codeium', 'windsurf', 'mcp_config.json'));
    expect(windsurfMcp.mcpServers).toHaveProperty('guardrails');
  });

  it('registers with Claude Desktop without clobbering other projects', () => {
    mkdirSync(join(appData, 'Claude'), { recursive: true });
    const configPath = join(appData, 'Claude', 'claude_desktop_config.json');
    writeFileSync(
      configPath,
      JSON.stringify(
        { mcpServers: { guardrails: { command: 'node', args: ['other-root'] } } },
        null,
        2,
      ),
    );

    shieldProject(options());
    const config = json(configPath) as { mcpServers: Record<string, unknown> };
    const keys = Object.keys(config.mcpServers);
    expect(keys).toContain('guardrails'); // the other project's entry survives
    expect(keys.some((k) => k.startsWith('guardrails-'))).toBe(true); // ours added
  });

  it('writes a managed TOML block for Codex and advisory AGENTS.md once', () => {
    mkdirSync(join(home, '.codex'), { recursive: true });
    mkdirSync(join(home, '.antigravity'), { recursive: true });

    const report = shieldProject(options());
    expect(report.results.find((r) => r.id === 'codex')?.level).toBe('advisory');
    expect(report.results.find((r) => r.id === 'antigravity')?.manualStep).toContain('connect');

    const toml = readFileSync(join(home, '.codex', 'config.toml'), 'utf8');
    expect(toml).toContain('[mcp_servers."guardrails-');
    expect(toml).toContain('command = "node"');

    const agents = readFileSync(join(project, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('Guardrails');
    // Codex and Antigravity share AGENTS.md - the block must appear exactly once.
    expect(agents.match(/secret safety rules/g)).toHaveLength(1);
  });

  it('leaves unparseable tool config untouched and reports it', () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    mkdirSync(join(project, '.claude'), { recursive: true });
    writeFileSync(join(project, '.claude', 'settings.json'), '{ not json');

    const report = shieldProject(options());
    const claude = report.results.find((r) => r.id === 'claude-code');
    expect(claude?.actions.some((a) => a.status === 'unparseable')).toBe(true);
    expect(readFileSync(join(project, '.claude', 'settings.json'), 'utf8')).toBe('{ not json');
  });

  it('honours the `only` filter', () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    mkdirSync(join(home, '.gemini'), { recursive: true });
    const report = shieldProject({ ...options(), only: ['gemini-cli'] });
    expect(report.results.map((r) => r.id)).toEqual(['gemini-cli']);
  });

  it('uses forward-slash paths in generated MCP args', () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    shieldProject(options());
    const mcp = json(join(project, '.mcp.json')) as {
      mcpServers: { guardrails: { args: string[] } };
    };
    for (const arg of mcp.mcpServers.guardrails.args) {
      expect(arg).not.toContain('\\');
    }
  });
});
