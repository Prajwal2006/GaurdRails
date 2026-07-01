import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
