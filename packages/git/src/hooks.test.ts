import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hookStatus,
  hooksStatus,
  installHook,
  installHooks,
  renderHookBlock,
  renderHookScript,
  uninstallHook,
  uninstallHooks,
} from './hooks.js';

let hooksDir: string;

beforeEach(() => {
  hooksDir = mkdtempSync(join(tmpdir(), 'guardrails-hooks-'));
});

afterEach(() => {
  rmSync(hooksDir, { recursive: true, force: true });
});

describe('rendering', () => {
  it('wraps the command in begin/end markers', () => {
    const block = renderHookBlock('pre-commit');
    expect(block).toContain('guardrails git pre-commit');
    expect(block).toContain('>>> guardrails >>>');
    expect(block).toContain('<<< guardrails <<<');
  });

  it('adds a shebang for a fresh script', () => {
    expect(renderHookScript('pre-push').startsWith('#!/bin/sh')).toBe(true);
  });
});

describe('installHook', () => {
  it('creates a new hook', () => {
    const result = installHook(hooksDir, 'pre-commit');
    expect(result.status).toBe('created');
    expect(existsSync(result.path)).toBe(true);
  });

  it('is idempotent (unchanged on second run)', () => {
    installHook(hooksDir, 'pre-commit');
    expect(installHook(hooksDir, 'pre-commit').status).toBe('unchanged');
  });

  it('appends to a pre-existing, unmanaged hook and preserves it', () => {
    const path = join(hooksDir, 'pre-commit');
    writeFileSync(path, '#!/bin/sh\necho "existing"\n', 'utf8');
    const result = installHook(hooksDir, 'pre-commit');
    expect(result.status).toBe('appended');
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('echo "existing"');
    expect(content).toContain('guardrails git pre-commit');
  });

  it('updates a stale managed block', () => {
    const path = join(hooksDir, 'pre-commit');
    writeFileSync(path, '#!/bin/sh\n# >>> guardrails >>>\nold\n# <<< guardrails <<<\n', 'utf8');
    expect(installHook(hooksDir, 'pre-commit').status).toBe('updated');
    expect(readFileSync(path, 'utf8')).toContain('guardrails git pre-commit');
  });
});

describe('uninstallHook', () => {
  it('removes a hook we created entirely', () => {
    const { path } = installHook(hooksDir, 'pre-commit');
    const result = uninstallHook(hooksDir, 'pre-commit');
    expect(result.status).toBe('removed');
    expect(existsSync(path)).toBe(false);
  });

  it('clears only our block from a shared hook', () => {
    const path = join(hooksDir, 'pre-commit');
    writeFileSync(path, '#!/bin/sh\necho "existing"\n', 'utf8');
    installHook(hooksDir, 'pre-commit');
    const result = uninstallHook(hooksDir, 'pre-commit');
    expect(result.status).toBe('cleared');
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('echo "existing"');
    expect(content).not.toContain('guardrails git');
  });

  it('reports absent when the hook does not exist', () => {
    expect(uninstallHook(hooksDir, 'pre-push').status).toBe('absent');
  });

  it('reports not-managed for a foreign hook', () => {
    writeFileSync(join(hooksDir, 'pre-push'), '#!/bin/sh\necho hi\n', 'utf8');
    expect(uninstallHook(hooksDir, 'pre-push').status).toBe('not-managed');
  });
});

describe('status and bulk operations', () => {
  it('reports managed status', () => {
    expect(hookStatus(hooksDir, 'pre-commit')).toMatchObject({ exists: false, managed: false });
    installHook(hooksDir, 'pre-commit');
    expect(hookStatus(hooksDir, 'pre-commit')).toMatchObject({ exists: true, managed: true });
  });

  it('installs and uninstalls all supported hooks', () => {
    const installed = installHooks(hooksDir);
    expect(installed.map((r) => r.hook).sort()).toEqual(['pre-commit', 'pre-push']);
    expect(hooksStatus(hooksDir).every((s) => s.managed)).toBe(true);
    const removed = uninstallHooks(hooksDir);
    expect(removed.every((r) => r.status === 'removed')).toBe(true);
  });

  it('can target a subset of hooks', () => {
    installHooks(hooksDir, { hooks: ['pre-push'] });
    expect(hookStatus(hooksDir, 'pre-push').managed).toBe(true);
    expect(hookStatus(hooksDir, 'pre-commit').exists).toBe(false);
  });
});
