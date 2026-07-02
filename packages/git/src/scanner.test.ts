import { describe, expect, it } from 'vitest';
import { Guardrails } from '@guardrails/core';
import type { GitRepo } from './git.js';
import { scanStaged, scanTracked } from './scanner.js';

const OPENAI = 'sk-' + 'a'.repeat(40);

/** A fake repo backed by an in-memory file map. */
function fakeRepo(files: Record<string, string>): GitRepo {
  const paths = Object.keys(files);
  return {
    root: '/repo',
    hooksDir: () => Promise.resolve('/repo/.git/hooks'),
    listStagedFiles: () => Promise.resolve(paths),
    readStagedContent: (path) => Promise.resolve(files[path]),
    listTrackedFiles: () => Promise.resolve(paths),
    readWorkingContent: (path) => Promise.resolve(files[path]),
  };
}

describe('scanStaged', () => {
  it('flags a staged secret and blocks', async () => {
    const repo = fakeRepo({ '.env': `OPENAI_API_KEY=${OPENAI}\n`, 'ok.ts': 'const x = 1;\n' });
    const result = await scanStaged(repo, new Guardrails());
    expect(result.filesScanned).toBe(2);
    expect(result.files).toHaveLength(1);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
    expect(result.outcome).toBe('deny');
  });

  it('is clean when nothing sensitive is staged', async () => {
    const repo = fakeRepo({ 'ok.ts': 'export const x = 1;\n' });
    const result = await scanStaged(repo, new Guardrails());
    expect(result.findings).toHaveLength(0);
    expect(result.blocked).toBe(false);
    expect(result.outcome).toBe('clean');
  });

  it('skips binary and oversized content', async () => {
    const repo = fakeRepo({
      'bin.dat': `pre\0${OPENAI}`,
      'big.txt': 'x'.repeat(100),
    });
    const result = await scanStaged(repo, new Guardrails(), { maxFileSize: 10 });
    expect(result.filesScanned).toBe(0);
  });

  it('skips files whose content cannot be read', async () => {
    const repo: GitRepo = {
      ...fakeRepo({ 'a.txt': 'x' }),
      listStagedFiles: () => Promise.resolve(['a.txt', 'missing.txt']),
      readStagedContent: (path) => Promise.resolve(path === 'a.txt' ? 'clean' : undefined),
    };
    const result = await scanStaged(repo, new Guardrails());
    expect(result.filesScanned).toBe(1);
  });
});

describe('scanTracked', () => {
  it('scans tracked files from the working tree', async () => {
    const repo = fakeRepo({ 'config/prod.env': `OPENAI_API_KEY=${OPENAI}\n` });
    const result = await scanTracked(repo, new Guardrails());
    expect(result.files).toHaveLength(1);
    expect(result.blocked).toBe(true);
  });
});
