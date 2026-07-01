import { describe, expect, it } from 'vitest';
import { normalizeFileRequest } from './normalize.js';

describe('normalizeFileRequest', () => {
  it('reads path and content from top-level fields', () => {
    const req = normalizeFileRequest('cursor', { path: 'a.ts', content: 'x' });
    expect(req).toEqual({ tool: 'cursor', path: 'a.ts', content: 'x' });
  });

  it('falls back through alternate field names', () => {
    expect(normalizeFileRequest('codex', { filePath: 'b.ts' }).path).toBe('b.ts');
    expect(normalizeFileRequest('codex', { file: 'c.ts', text: 'y' }).content).toBe('y');
  });

  it('reads from nested params/arguments/input', () => {
    expect(normalizeFileRequest('claude-code', { params: { path: 'n.ts' } }).path).toBe('n.ts');
    expect(normalizeFileRequest('claude-code', { arguments: { file: 'm.ts' } }).path).toBe('m.ts');
  });

  it('strips a file:// scheme', () => {
    expect(normalizeFileRequest('copilot', { uri: 'file:///tmp/x.ts' }).path).toBe('/tmp/x.ts');
  });

  it('omits content when absent and defaults path to empty', () => {
    const req = normalizeFileRequest('gemini-cli', {});
    expect(req.path).toBe('');
    expect('content' in req).toBe(false);
  });

  it('tolerates non-object input', () => {
    expect(normalizeFileRequest('windsurf', null).path).toBe('');
    expect(normalizeFileRequest('windsurf', 42).path).toBe('');
  });
});
