import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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

  it('refuses to follow a symlink that points outside the root', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'guardrails-outside-'));
    try {
      writeFileSync(join(outside, 'secret.txt'), 'TOP SECRET');
      const served = join(dir, 'served');
      mkdirSync(served, { recursive: true });
      try {
        symlinkSync(join(outside, 'secret.txt'), join(served, 'link.txt'));
      } catch {
        return; // symlinks unavailable (e.g. Windows without privileges) - skip
      }
      expect(await diskFileSource(served).read('link.txt')).toBeUndefined();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('still reads through a symlink that stays inside the root', async () => {
    writeFileSync(join(dir, 'real.txt'), 'inside');
    try {
      symlinkSync(join(dir, 'real.txt'), join(dir, 'alias.txt'));
    } catch {
      return; // symlinks unavailable - skip
    }
    expect(await diskFileSource(dir).read('alias.txt')).toBe('inside');
  });
});
