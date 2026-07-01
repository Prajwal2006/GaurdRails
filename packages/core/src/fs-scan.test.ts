import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Guardrails } from './inspection.js';
import { scanPath } from './fs-scan.js';

const OPENAI = 'sk-' + 'a'.repeat(40);
let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'guardrails-scan-'));
  await writeFile(join(root, '.env'), `OPENAI_API_KEY=${OPENAI}\n`);
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'app.ts'), 'export const x = 1;\n');
  await mkdir(join(root, 'node_modules'));
  await writeFile(join(root, 'node_modules', 'leak.js'), `const k = "${OPENAI}";\n`);
  // A "binary" file with a null byte should be skipped.
  await writeFile(join(root, 'logo.png'), Buffer.from([0x00, 0x01, 0x02, ...Buffer.from(OPENAI)]));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('scanPath', () => {
  it('scans a directory, skipping ignored dirs and binary files', async () => {
    const result = await scanPath(root, new Guardrails());
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('.env');
    expect(paths.some((p) => p.startsWith('node_modules'))).toBe(false);
    expect(paths).not.toContain('logo.png');
    // .env and src/app.ts are read; node_modules and the binary are skipped.
    expect(result.filesScanned).toBe(2);
    expect(result.summary.total).toBeGreaterThan(0);
  });

  it('can scan a single file', async () => {
    const result = await scanPath(join(root, '.env'), new Guardrails());
    expect(result.files).toHaveLength(1);
    expect(result.filesScanned).toBe(1);
  });

  it('skips files larger than maxFileSize', async () => {
    const result = await scanPath(root, new Guardrails(), { maxFileSize: 5 });
    expect(result.filesScanned).toBe(0);
    expect(result.files).toHaveLength(0);
  });

  it('honours extra ignoreDirs', async () => {
    const result = await scanPath(root, new Guardrails(), { ignoreDirs: ['src'] });
    expect(result.filesScanned).toBe(1); // just .env
  });
});
