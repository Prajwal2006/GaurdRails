import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { run } from './cli.js';
import { createBufferIO } from './io.js';

const execFileAsync = promisify(execFile);
const OPENAI = 'sk-' + 'a'.repeat(40);

let dir: string;
let originalCwd: string;
let gitAvailable = true;

beforeAll(async () => {
  process.env.NO_COLOR = '1';
  originalCwd = process.cwd();
  dir = await mkdtemp(join(tmpdir(), 'guardrails-gitcli-'));
  process.chdir(dir);
  try {
    await execFileAsync('git', ['init'], { cwd: dir });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    await writeFile(join(dir, 'clean.ts'), 'export const x = 1;\n');
    await writeFile(join(dir, '.env'), `OPENAI_API_KEY=${OPENAI}\n`);
    await execFileAsync('git', ['add', 'clean.ts', '.env'], { cwd: dir });
  } catch {
    gitAvailable = false;
  }
});

afterAll(async () => {
  process.chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('git hooks', () => {
  it('installs, reports status, and uninstalls hooks', async () => {
    if (!gitAvailable) return;
    const install = createBufferIO();
    expect(await run(['git', 'install'], install)).toBe(0);
    expect(install.stdout.join('\n')).toContain('pre-commit');

    const status = createBufferIO();
    expect(await run(['git', 'status'], status)).toBe(0);
    expect(status.stdout.join('\n')).toContain('installed');

    const uninstall = createBufferIO();
    expect(await run(['git', 'uninstall'], uninstall)).toBe(0);
  });
});

describe('git scan', () => {
  it('finds a staged secret and never leaks it', async () => {
    if (!gitAvailable) return;
    const io = createBufferIO();
    const code = await run(['git', 'scan'], io);
    expect(code).toBe(1);
    const text = io.stdout.join('\n');
    expect(text).toContain('.env');
    expect(text).not.toContain(OPENAI);
  });

  it('supports JSON output', async () => {
    if (!gitAvailable) return;
    const io = createBufferIO();
    const code = await run(['git', 'scan', '--json'], io);
    expect(code).toBe(1);
    const parsed = JSON.parse(io.stdout.join('\n')) as { totalFindings: number };
    expect(parsed.totalFindings).toBeGreaterThan(0);
  });
});

describe('git pre-commit hook', () => {
  it('blocks (exit 1) and writes an educational message to stderr', async () => {
    if (!gitAvailable) return;
    const io = createBufferIO();
    const code = await run(['git', 'pre-commit'], io);
    expect(code).toBe(1);
    const err = io.stderr.join('\n');
    expect(err).toContain('Guardrails stopped this commit');
    expect(err).toContain('Stopped safely');
    expect(err).not.toContain(OPENAI);
  });
});

describe('git fix', () => {
  it('applies .gitignore and .env.example fixes', async () => {
    if (!gitAvailable) return;
    const io = createBufferIO();
    const code = await run(['git', 'fix'], io);
    expect(code).toBe(0);
    expect(io.stdout.join('\n')).toMatch(/gitignore|env-example/);
  });
});
