import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { diskFileSource } from './file-source.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'guardrails-src-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('diskFileSource', () => {
  it('lists files recursively with forward slashes and skips ignored dirs', async () => {
    mkdirSync(join(dir, 'src'), { recursive: true });
    mkdirSync(join(dir, 'node_modules'), { recursive: true });
    writeFileSync(join(dir, 'src', 'a.ts'), 'x');
    writeFileSync(join(dir, 'node_modules', 'dep.js'), 'y');
    const listed = await diskFileSource(dir).list();
    expect(listed).toContain('src/a.ts');
    expect(listed.some((p) => p.includes('node_modules'))).toBe(false);
  });

  it('reads files inside the root', async () => {
    writeFileSync(join(dir, 'a.ts'), 'hello');
    expect(await diskFileSource(dir).read('a.ts')).toBe('hello');
  });

  it('refuses path traversal outside the root', async () => {
    expect(await diskFileSource(dir).read('../../etc/passwd')).toBeUndefined();
  });

  it('returns undefined for a missing file', async () => {
    expect(await diskFileSource(dir).read('nope.ts')).toBeUndefined();
  });
});
