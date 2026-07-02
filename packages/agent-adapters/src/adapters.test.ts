import { describe, expect, it } from 'vitest';
import { createAgentAdapter } from './base.js';
import { claudeCodeAdapter, getAdapter, listAdapters } from './adapters.js';

describe('createAgentAdapter.normalizeRequest', () => {
  const adapter = claudeCodeAdapter;

  it('extracts a path from common keys', () => {
    expect(adapter.normalizeRequest({ path: '.env' })).toEqual({
      tool: 'claude-code',
      path: '.env',
    });
    expect(adapter.normalizeRequest({ file: 'a.ts' }).path).toBe('a.ts');
    expect(adapter.normalizeRequest({ filePath: 'b.ts' }).path).toBe('b.ts');
  });

  it('resolves file:// URIs to plain paths', () => {
    expect(adapter.normalizeRequest({ uri: 'file:///home/user/.env' }).path).toBe(
      '/home/user/.env',
    );
  });

  it('captures content when present', () => {
    expect(adapter.normalizeRequest({ path: 'a', content: 'x' })).toEqual({
      tool: 'claude-code',
      path: 'a',
      content: 'x',
    });
  });

  it('throws for non-objects and missing paths', () => {
    expect(() => adapter.normalizeRequest(42)).toThrow();
    expect(() => adapter.normalizeRequest({ nope: 1 })).toThrow(/file path/);
  });

  it('supports custom keys', () => {
    const custom = createAgentAdapter({
      id: 'custom-tool',
      displayName: 'Custom',
      pathKeys: ['location'],
      contentKeys: ['blob'],
    });
    expect(custom.normalizeRequest({ location: 'x', blob: 'y' })).toEqual({
      tool: 'custom-tool',
      path: 'x',
      content: 'y',
    });
  });
});

describe('formatResponse', () => {
  it('emits a neutral, tool-tagged object without undefined fields', () => {
    expect(claudeCodeAdapter.formatResponse({ allowed: true, content: 'ok' })).toEqual({
      tool: 'claude-code',
      allowed: true,
      content: 'ok',
    });
    expect(claudeCodeAdapter.formatResponse({ allowed: false, message: 'denied' })).toEqual({
      tool: 'claude-code',
      allowed: false,
      message: 'denied',
    });
  });
});

describe('registry', () => {
  it('exposes all major coding assistants', () => {
    const ids = listAdapters().map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'claude-code',
        'codex',
        'copilot',
        'gemini-cli',
        'cursor',
        'windsurf',
      ]),
    );
  });

  it('looks up adapters by id', () => {
    expect(getAdapter('cursor')?.displayName).toBe('Cursor');
    expect(getAdapter('unknown-tool')).toBeUndefined();
  });
});
