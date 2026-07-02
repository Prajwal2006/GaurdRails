import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureManagedBlock, hashMarkers, htmlMarkers, removeManagedBlock } from './managed.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'guardrails-managed-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('ensureManagedBlock', () => {
  it('creates the file (and parent dirs) when missing', () => {
    const path = join(dir, 'nested', '.cursorignore');
    expect(ensureManagedBlock(path, ['.env', '*.pem'])).toBe('created');
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('# >>> guardrails >>>');
    expect(content).toContain('.env');
    expect(content).toContain('# <<< guardrails <<<');
  });

  it('appends to an existing file without touching user content', () => {
    const path = join(dir, '.gitignore');
    writeFileSync(path, 'node_modules\n');
    expect(ensureManagedBlock(path, ['.env'])).toBe('appended');
    const content = readFileSync(path, 'utf8');
    expect(content.startsWith('node_modules\n')).toBe(true);
    expect(content).toContain('.env');
  });

  it('is idempotent and updates the block in place', () => {
    const path = join(dir, 'file');
    ensureManagedBlock(path, ['a']);
    expect(ensureManagedBlock(path, ['a'])).toBe('unchanged');
    expect(ensureManagedBlock(path, ['b'])).toBe('updated');
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('b');
    expect(content).not.toContain('\na\n');
  });

  it('supports html markers for markdown files', () => {
    const path = join(dir, 'CLAUDE.md');
    writeFileSync(path, '# My project\n');
    ensureManagedBlock(path, ['Do not read .env.'], htmlMarkers());
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('<!-- >>> guardrails >>> -->');
    expect(content).toContain('# My project');
  });

  it('keeps separately-labelled blocks independent', () => {
    const path = join(dir, 'config.toml');
    ensureManagedBlock(path, ['[a]'], hashMarkers('guardrails:a'));
    ensureManagedBlock(path, ['[b]'], hashMarkers('guardrails:b'));
    ensureManagedBlock(path, ['[a2]'], hashMarkers('guardrails:a'));
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('[a2]');
    expect(content).toContain('[b]');
    expect(content).not.toContain('\n[a]\n');
  });
});

describe('removeManagedBlock', () => {
  it('removes only the managed block', () => {
    const path = join(dir, 'file');
    writeFileSync(path, 'user line\n');
    ensureManagedBlock(path, ['.env']);
    expect(removeManagedBlock(path)).toBe('removed');
    expect(readFileSync(path, 'utf8')).toBe('user line\n');
    expect(removeManagedBlock(path)).toBe('absent');
  });
});
