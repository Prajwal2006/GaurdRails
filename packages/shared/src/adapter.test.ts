import { describe, expect, it } from 'vitest';
import { KNOWN_AGENTS, toDetectionInput, type FileReadRequest } from './adapter.js';

describe('toDetectionInput', () => {
  it('passes through content when provided', () => {
    const request: FileReadRequest = { tool: 'claude-code', path: '.env', content: 'A=1' };
    expect(toDetectionInput(request)).toEqual({ path: '.env', content: 'A=1' });
  });

  it('defaults content to empty string when the tool sends only a path', () => {
    const request: FileReadRequest = { tool: 'cursor', path: 'id_rsa' };
    expect(toDetectionInput(request)).toEqual({ path: 'id_rsa', content: '' });
  });
});

describe('KNOWN_AGENTS', () => {
  it('includes the major coding assistants', () => {
    expect(KNOWN_AGENTS).toContain('claude-code');
    expect(KNOWN_AGENTS).toContain('copilot');
    expect(KNOWN_AGENTS).toContain('gemini-cli');
  });
});
