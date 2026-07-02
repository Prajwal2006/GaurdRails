import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Guardrails } from '@guardrails/core';
import {
  applyFixes,
  buildEnvExample,
  ensureGitignore,
  gitignorePatternsFor,
  isEnvFile,
  suggestFixes,
  writeEnvExample,
} from './autofix.js';
import { scanTracked } from './scanner.js';
import type { GitRepo } from './git.js';

const OPENAI = 'sk-' + 'a'.repeat(40);
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'guardrails-fix-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('gitignorePatternsFor', () => {
  it('maps secret files to patterns and de-dupes', () => {
    const patterns = gitignorePatternsFor(['.env', 'config/.env.local', 'server.pem', 'app.ts']);
    expect(patterns).toContain('.env');
    expect(patterns).toContain('*.pem');
    expect(patterns).not.toContain('app.ts');
  });

  it('returns nothing for ordinary files', () => {
    expect(gitignorePatternsFor(['index.ts', 'README.md'])).toEqual([]);
  });
});

describe('isEnvFile', () => {
  it('recognizes dotenv files', () => {
    expect(isEnvFile('.env')).toBe(true);
    expect(isEnvFile('config/.env.production')).toBe(true);
    expect(isEnvFile('main.ts')).toBe(false);
  });
});

describe('buildEnvExample', () => {
  it('keeps keys, drops values, preserves comments', () => {
    const example = buildEnvExample(
      '# comment\nAPI_KEY=secret123\n\nDB=postgres://u:p@h/d\nBAD_LINE',
    );
    expect(example).toContain('# comment');
    expect(example).toContain('API_KEY=');
    expect(example).not.toContain('secret123');
    expect(example).not.toContain('postgres://u:p@h/d');
    expect(example).toContain('BAD_LINE');
  });
});

describe('ensureGitignore', () => {
  it('appends missing patterns and skips existing ones', () => {
    writeFileSync(join(dir, '.gitignore'), '.env\n', 'utf8');
    const applied = ensureGitignore(dir, ['.env', '*.pem']);
    expect(applied?.detail).toContain('*.pem');
    const content = readFileSync(join(dir, '.gitignore'), 'utf8');
    expect(content.match(/\.env/g)?.length).toBe(1); // not duplicated
    expect(content).toContain('*.pem');
  });

  it('creates the file when missing', () => {
    ensureGitignore(dir, ['*.key']);
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('*.key');
  });

  it('returns undefined when nothing to add', () => {
    expect(ensureGitignore(dir, [])).toBeUndefined();
    writeFileSync(join(dir, '.gitignore'), '*.pem\n', 'utf8');
    expect(ensureGitignore(dir, ['*.pem'])).toBeUndefined();
  });
});

describe('writeEnvExample', () => {
  it('creates a value-free example beside the .env', () => {
    writeFileSync(join(dir, '.env'), `OPENAI_API_KEY=${OPENAI}\n`, 'utf8');
    const applied = writeEnvExample(dir, '.env');
    expect(applied?.path.endsWith('.env.example')).toBe(true);
    const content = readFileSync(join(dir, '.env.example'), 'utf8');
    expect(content).toContain('OPENAI_API_KEY=');
    expect(content).not.toContain(OPENAI);
  });

  it('does not overwrite an existing example and skips a missing source', () => {
    writeFileSync(join(dir, '.env'), 'A=1\n', 'utf8');
    writeFileSync(join(dir, '.env.example'), 'A=\n', 'utf8');
    expect(writeEnvExample(dir, '.env')).toBeUndefined();
    expect(writeEnvExample(dir, 'nope.env')).toBeUndefined();
  });
});

function repoFor(files: Record<string, string>): GitRepo {
  const paths = Object.keys(files);
  return {
    root: dir,
    hooksDir: () => Promise.resolve(join(dir, '.git', 'hooks')),
    listStagedFiles: () => Promise.resolve(paths),
    readStagedContent: (p) => Promise.resolve(files[p]),
    listTrackedFiles: () => Promise.resolve(paths),
    readWorkingContent: (p) => Promise.resolve(files[p]),
  };
}

describe('suggestFixes / applyFixes', () => {
  it('suggests gitignore, env-example, and rotation', async () => {
    const repo = repoFor({ '.env': `OPENAI_API_KEY=${OPENAI}\n` });
    const result = await scanTracked(repo, new Guardrails());
    const titles = suggestFixes(result).map((f) => f.title);
    expect(titles).toContain('Stop tracking secret files');
    expect(titles).toContain('Share config safely');
    expect(titles).toContain('Rotate exposed credentials');
  });

  it('applies fixes on disk', async () => {
    writeFileSync(join(dir, '.env'), `OPENAI_API_KEY=${OPENAI}\n`, 'utf8');
    const repo = repoFor({ '.env': `OPENAI_API_KEY=${OPENAI}\n` });
    const result = await scanTracked(repo, new Guardrails());
    const applied = applyFixes(dir, result);
    expect(applied.some((a) => a.kind === 'gitignore')).toBe(true);
    expect(applied.some((a) => a.kind === 'env-example')).toBe(true);
    expect(existsSync(join(dir, '.gitignore'))).toBe(true);
    expect(existsSync(join(dir, '.env.example'))).toBe(true);
  });
});
