import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from './cli.js';
import { createBufferIO } from './io.js';

const OPENAI = 'sk-' + 'a'.repeat(40);
let dir: string;
let originalCwd: string;

beforeAll(async () => {
  process.env.NO_COLOR = '1';
  originalCwd = process.cwd();
  dir = await mkdtemp(join(tmpdir(), 'guardrails-cli-'));
  await writeFile(join(dir, '.env'), `OPENAI_API_KEY=${OPENAI}\n`);
  await writeFile(join(dir, 'clean.ts'), 'export const x = 1;\n');
  process.chdir(dir); // isolated: vitest runs each test file in its own process
});

afterAll(async () => {
  process.chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('scan', () => {
  it('reports no secrets for a clean file (exit 0)', async () => {
    const io = createBufferIO();
    const code = await run(['scan', 'clean.ts'], io);
    expect(code).toBe(0);
    expect(io.stdout.join('\n')).toContain('No secrets found');
  });

  it('finds secrets and exits non-zero', async () => {
    const io = createBufferIO();
    const code = await run(['scan', '.'], io);
    expect(code).toBe(1);
    expect(io.stdout.join('\n')).toContain('OpenAI API key');
  });

  it('supports JSON output', async () => {
    const io = createBufferIO();
    const code = await run(['scan', '.', '--json'], io);
    expect(code).toBe(1);
    const parsed = JSON.parse(io.stdout.join('\n')) as { totalFindings: number };
    expect(parsed.totalFindings).toBeGreaterThan(0);
  });

  it('never prints the raw secret', async () => {
    const io = createBufferIO();
    await run(['scan', '.'], io);
    expect(io.stdout.join('\n')).not.toContain(OPENAI);
  });

  it('works via the `secrets` alias', async () => {
    const io = createBufferIO();
    expect(await run(['secrets', 'clean.ts'], io)).toBe(0);
  });
});

describe('explain', () => {
  it('explains a known type', async () => {
    const io = createBufferIO();
    const code = await run(['explain', 'openai'], io);
    expect(code).toBe(0);
    const text = io.stdout.join('\n');
    expect(text).toContain('API key');
    expect(text).toContain('How to fix it');
  });

  it('fails helpfully for an unknown type', async () => {
    const io = createBufferIO();
    expect(await run(['explain', 'banana'], io)).toBe(1);
  });

  it('respects the experience level flag', async () => {
    const io = createBufferIO();
    expect(await run(['explain', 'aws', '--level', 'professional'], io)).toBe(0);
  });
});

describe('other commands', () => {
  it('doctor runs and reports checks', async () => {
    const io = createBufferIO();
    const code = await run(['doctor'], io);
    expect([0, 1]).toContain(code);
    expect(io.stdout.join('\n')).toContain('doctor');
  });

  it('status prints configuration', async () => {
    const io = createBufferIO();
    expect(await run(['status'], io)).toBe(0);
    expect(io.stdout.join('\n')).toContain('Active policy');
  });

  it('init creates config and policy files', async () => {
    const io = createBufferIO();
    expect(await run(['init'], io)).toBe(0);
    expect(existsSync(join(dir, '.guardrails', 'config.json'))).toBe(true);
    expect(existsSync(join(dir, '.guardrails', 'policy.json'))).toBe(true);
  });

  it('config prints JSON', async () => {
    const io = createBufferIO();
    expect(await run(['config'], io)).toBe(0);
    expect(() => {
      JSON.parse(io.stdout.join('\n'));
    }).not.toThrow();
  });

  it('policies lists rules', async () => {
    const io = createBufferIO();
    expect(await run(['policies'], io)).toBe(0);
    expect(io.stdout.join('\n')).toContain('deny-high-severity');
  });

  it('agents lists supported AI tools', async () => {
    const io = createBufferIO();
    expect(await run(['agents'], io)).toBe(0);
    const text = io.stdout.join('\n');
    expect(text).toContain('Claude Code');
    expect(text).toContain('Cursor');
  });
});

describe('report', () => {
  it('generates a Markdown report', async () => {
    const io = createBufferIO();
    expect(await run(['report', '.'], io)).toBe(0);
    expect(io.stdout.join('\n')).toContain('# Guardrails security report');
  });

  it('writes a report to a file', async () => {
    const io = createBufferIO();
    const out = join(dir, 'report.md');
    expect(await run(['report', '.', '--output', out], io)).toBe(0);
    const content = await readFile(out, 'utf8');
    expect(content).toContain('Guardrails security report');
  });

  it('generates JSON', async () => {
    const io = createBufferIO();
    expect(await run(['report', '.', '--format', 'json'], io)).toBe(0);
    expect(() => {
      JSON.parse(io.stdout.join('\n'));
    }).not.toThrow();
  });
});

describe('meta', () => {
  it('prints the version', async () => {
    const io = createBufferIO();
    expect(await run(['--version'], io)).toBe(0);
    expect(io.stdout.join('\n')).toContain('0.1.0');
  });

  it('returns non-zero for an unknown command', async () => {
    const io = createBufferIO();
    expect(await run(['frobnicate'], io)).not.toBe(0);
  });
});
