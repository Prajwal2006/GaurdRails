import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { addToStringArray, mergeJsonFile, objectAt } from './json-file.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'guardrails-json-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('mergeJsonFile', () => {
  it('creates a new file with parent directories', () => {
    const path = join(dir, 'a', 'b.json');
    const result = mergeJsonFile(path, (c) => {
      c.hello = 'world';
    });
    expect(result.status).toBe('created');
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ hello: 'world' });
  });

  it('preserves existing keys and writes a one-time backup', () => {
    const path = join(dir, 'config.json');
    writeFileSync(path, JSON.stringify({ theme: 'dark', mcpServers: { other: {} } }, null, 2));

    const result = mergeJsonFile(path, (c) => {
      objectAt(c, 'mcpServers').guardrails = { command: 'node' };
    });
    expect(result.status).toBe('updated');

    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    expect(parsed.theme).toBe('dark');
    expect(parsed.mcpServers).toHaveProperty('other');
    expect(parsed.mcpServers).toHaveProperty('guardrails');

    const backup = `${path}.guardrails-backup`;
    expect(existsSync(backup)).toBe(true);
    expect(JSON.parse(readFileSync(backup, 'utf8'))).toEqual({
      theme: 'dark',
      mcpServers: { other: {} },
    });

    // A second edit must not overwrite the original backup.
    mergeJsonFile(path, (c) => {
      c.extra = 1;
    });
    expect(JSON.parse(readFileSync(backup, 'utf8'))).not.toHaveProperty('guardrails');
  });

  it('reports unchanged when the mutation is a no-op', () => {
    const path = join(dir, 'same.json');
    mergeJsonFile(path, (c) => {
      c.a = 1;
    });
    expect(mergeJsonFile(path, (c) => (c.a = 1)).status).toBe('unchanged');
  });

  it('refuses to touch invalid JSON', () => {
    const path = join(dir, 'broken.json');
    writeFileSync(path, '{ "a": 1, // comment\n}');
    const result = mergeJsonFile(path, (c) => {
      c.b = 2;
    });
    expect(result.status).toBe('unparseable');
    expect(readFileSync(path, 'utf8')).toContain('// comment');
  });
});

describe('helpers', () => {
  it('objectAt creates or reuses nested objects', () => {
    const config: Record<string, unknown> = { existing: { keep: true } };
    expect(objectAt(config, 'existing')).toEqual({ keep: true });
    objectAt(config, 'fresh').x = 1;
    expect(config.fresh).toEqual({ x: 1 });
  });

  it('addToStringArray dedupes while preserving user entries', () => {
    const config: Record<string, unknown> = { deny: ['UserRule(1)'] };
    addToStringArray(config, 'deny', ['Read(./.env)', 'UserRule(1)']);
    expect(config.deny).toEqual(['UserRule(1)', 'Read(./.env)']);
  });
});
