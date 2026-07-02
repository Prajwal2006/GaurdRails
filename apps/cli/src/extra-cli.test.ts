import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from './cli.js';
import { createBufferIO } from './io.js';

let dir: string;
let originalCwd: string;

beforeAll(async () => {
  process.env.NO_COLOR = '1';
  originalCwd = process.cwd();
  dir = await mkdtemp(join(tmpdir(), 'guardrails-extra-'));
  process.chdir(dir);
});

afterAll(async () => {
  process.chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('adapters', () => {
  it('lists supported AI tools', async () => {
    const io = createBufferIO();
    expect(await run(['adapters'], io)).toBe(0);
    const text = io.stdout.join('\n');
    expect(text).toContain('Claude Code');
    expect(text).toContain('Cursor');
  });
});

describe('setup', () => {
  it('creates config and shields detected tools hermetically', async () => {
    // Point shield detection at an isolated fake home so the test never
    // touches the real machine's AI tool configs.
    const fakeHome = join(dir, 'fake-home');
    await mkdir(join(fakeHome, '.claude'), { recursive: true });
    await mkdir(join(fakeHome, '.gemini'), { recursive: true });
    process.env.GUARDRAILS_HOME = fakeHome;
    process.env.GUARDRAILS_APPDATA = join(fakeHome, 'AppData', 'Roaming');
    try {
      const io = createBufferIO();
      expect(await run(['setup'], io)).toBe(0);
      const text = io.stdout.join('\n');
      expect(text).toContain('Config');
      expect(text).toContain('Claude Code');
      expect(text).toContain('Gemini CLI');
      expect(text).toContain('reading blocked');
      // Hard enforcement files were written into the project.
      expect(JSON.parse(await readFile(join(dir, '.claude', 'settings.json'), 'utf8'))).toHaveProperty(
        'permissions',
      );
      expect(await readFile(join(dir, '.geminiignore'), 'utf8')).toContain('.env');
      // The shielded tool list is recorded for later new-tool notices.
      const config = JSON.parse(await readFile(join(dir, '.guardrails', 'config.json'), 'utf8')) as {
        shieldedTools: string[];
      };
      expect(config.shieldedTools).toContain('claude-code');
    } finally {
      delete process.env.GUARDRAILS_HOME;
      delete process.env.GUARDRAILS_APPDATA;
    }
  });

  it('reports gracefully when no AI tools are found', async () => {
    const emptyHome = join(dir, 'empty-home');
    await mkdir(emptyHome, { recursive: true });
    process.env.GUARDRAILS_HOME = emptyHome;
    process.env.GUARDRAILS_APPDATA = join(emptyHome, 'AppData', 'Roaming');
    try {
      const io = createBufferIO();
      const sub = join(dir, 'no-tools-project');
      await mkdir(sub, { recursive: true });
      const previous = process.cwd();
      process.chdir(sub);
      try {
        expect(await run(['setup'], io)).toBe(0);
        expect(io.stdout.join('\n')).toContain('No AI coding tools found');
      } finally {
        process.chdir(previous);
      }
    } finally {
      delete process.env.GUARDRAILS_HOME;
      delete process.env.GUARDRAILS_APPDATA;
    }
  });
});

describe('connect', () => {
  it('lists connectable tools when no tool is given', async () => {
    const io = createBufferIO();
    expect(await run(['connect'], io)).toBe(0);
    const text = io.stdout.join('\n');
    expect(text).toContain('claude-code');
    expect(text).toContain('gemini-cli');
    expect(text).toContain('copilot');
  });

  it('prints a claude-desktop JSON snippet with paths filled in', async () => {
    const io = createBufferIO();
    expect(await run(['connect', 'claude-desktop'], io)).toBe(0);
    const text = io.stdout.join('\n');
    expect(text).toContain('"mcpServers"');
    expect(text).toContain('"guardrails"');
    expect(text).toContain('mcp');
    expect(text).toContain('serve');
    expect(text).toContain('claude_desktop_config.json');
  });

  it('rejects an unknown tool with a helpful error', async () => {
    const io = createBufferIO();
    expect(await run(['connect', 'notepad'], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain('Unknown tool');
  });
});

describe('mcp info', () => {
  it('describes the server without starting it', async () => {
    const io = createBufferIO();
    expect(await run(['mcp', 'info'], io)).toBe(0);
    const text = io.stdout.join('\n');
    expect(text).toContain('read_file, list_files');
    expect(text).toContain('stdio');
  });
});

describe('audit', () => {
  it('reports an empty log gracefully', async () => {
    const io = createBufferIO();
    expect(await run(['audit'], io)).toBe(0);
    expect(io.stdout.join('\n')).toContain('No audit events');
  });

  it('reads events from a file and supports JSON', async () => {
    const file = join(dir, 'audit.jsonl');
    const event = {
      id: '1',
      timestamp: '2026-01-01T00:00:00.000Z',
      action: 'deny',
      reason: 'blocked secret',
      tool: 'claude-code',
      path: '.env',
    };
    await writeFile(file, `${JSON.stringify(event)}\n`);

    const human = createBufferIO();
    expect(await run(['audit', '--file', file], human)).toBe(0);
    expect(human.stdout.join('\n')).toContain('blocked secret');

    const json = createBufferIO();
    expect(await run(['audit', '--file', file, '--json'], json)).toBe(0);
    const parsed = JSON.parse(json.stdout.join('\n')) as Array<{ action: string }>;
    expect(parsed[0]?.action).toBe('deny');
  });

  it('honours the limit flag', async () => {
    const file = join(dir, 'audit2.jsonl');
    const lines = ['a', 'b', 'c']
      .map((r, i) =>
        JSON.stringify({
          id: String(i),
          timestamp: '2026-01-01T00:00:00.000Z',
          action: 'audit-only',
          reason: r,
        }),
      )
      .join('\n');
    await writeFile(file, `${lines}\n`);
    const io = createBufferIO();
    expect(await run(['audit', '--file', file, '--limit', '1', '--json'], io)).toBe(0);
    const parsed = JSON.parse(io.stdout.join('\n')) as unknown[];
    expect(parsed).toHaveLength(1);
  });
});
