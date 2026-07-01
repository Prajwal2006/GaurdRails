import { describe, expect, it } from 'vitest';
import type { MediatedResponse } from '@guardrails/shared';
import { BUILT_IN_ADAPTERS, claudeCodeAdapter, copilotAdapter } from './adapters.js';
import { AdapterRegistry } from './registry.js';

describe('adapters', () => {
  it('normalize through the adapter tags the tool id', () => {
    expect(claudeCodeAdapter.normalizeRequest({ path: 'a.ts' }).tool).toBe('claude-code');
    expect(copilotAdapter.normalizeRequest({ path: 'a.ts' }).tool).toBe('copilot');
  });

  it('formats an MCP-style allowed response', () => {
    const res = claudeCodeAdapter.formatResponse({ allowed: true, content: 'hello' }) as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(res.isError).toBe(false);
    expect(res.content[0]?.text).toBe('hello');
  });

  it('formats an MCP-style denied response as an error', () => {
    const res = claudeCodeAdapter.formatResponse({
      allowed: false,
      message: 'nope',
    }) as { isError: boolean; content: Array<{ text: string }> };
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toBe('nope');
  });

  it('includes an educational message alongside allowed content', () => {
    const res = claudeCodeAdapter.formatResponse({
      allowed: true,
      content: 'body',
      message: 'redacted 1 secret',
    }) as { content: Array<{ text: string }> };
    expect(res.content).toHaveLength(2);
  });

  it('formats a flat response for Copilot', () => {
    const allowed: MediatedResponse = { allowed: true, content: 'body' };
    expect(copilotAdapter.formatResponse(allowed)).toEqual({ allowed: true, content: 'body' });
    const denied: MediatedResponse = { allowed: false, message: 'blocked' };
    expect(copilotAdapter.formatResponse(denied)).toEqual({ allowed: false, message: 'blocked' });
  });
});

describe('AdapterRegistry', () => {
  it('preloads all built-in adapters', () => {
    const registry = AdapterRegistry.withDefaults();
    expect(registry.size).toBe(BUILT_IN_ADAPTERS.length);
    expect(registry.get('claude-code')?.displayName).toBe('Claude Code');
    expect(registry.has('cursor')).toBe(true);
  });

  it('registers and unregisters custom adapters', () => {
    const registry = new AdapterRegistry();
    registry.register(claudeCodeAdapter);
    expect(registry.list()).toHaveLength(1);
    expect(registry.unregister('claude-code')).toBe(true);
    expect(registry.unregister('claude-code')).toBe(false);
    expect(registry.get('nope')).toBeUndefined();
  });
});
