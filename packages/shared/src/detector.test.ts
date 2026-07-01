import { describe, expect, it } from 'vitest';
import { createDetectionContext, fnv1a, locate } from './detector.js';

describe('locate', () => {
  it('reports 1-based line and column', () => {
    const content = 'line1\nline2\nXsecret';
    const index = content.indexOf('X');
    expect(locate(content, index)).toEqual({ line: 3, column: 1 });
  });

  it('handles offset 0', () => {
    expect(locate('abc', 0)).toEqual({ line: 1, column: 1 });
  });

  it('clamps out-of-range offsets', () => {
    expect(locate('abc', 999).line).toBe(1);
    expect(locate('a\nb', -5)).toEqual({ line: 1, column: 1 });
  });
});

describe('fnv1a', () => {
  it('is deterministic and 8 hex chars', () => {
    const a = fnv1a('hello');
    const b = fnv1a('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('differs for different inputs', () => {
    expect(fnv1a('a')).not.toBe(fnv1a('b'));
  });
});

describe('DetectionContext.finding', () => {
  const content = 'OPENAI_API_KEY=sk-abc123def456ghi789xyz\n';
  const index = content.indexOf('sk-');
  const match = 'sk-abc123def456ghi789xyz';

  it('builds a finding with location and a masked preview', () => {
    const ctx = createDetectionContext({ path: '.env', content });
    const finding = ctx.finding({
      detectorId: 'openai',
      detectorKind: 'regex',
      title: 'OpenAI API key',
      category: 'api-key',
      severity: 'critical',
      confidence: 'high',
      match,
      index,
    });

    expect(finding.path).toBe('.env');
    expect(finding.line).toBe(1);
    expect(finding.column).toBe(index + 1);
    expect(finding.length).toBe(match.length);
    expect(finding.detectorKind).toBe('regex');
    expect(finding.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it('NEVER stores the raw value anywhere on the finding', () => {
    const ctx = createDetectionContext({ path: '.env', content });
    const finding = ctx.finding({
      detectorId: 'openai',
      title: 'OpenAI API key',
      category: 'api-key',
      severity: 'critical',
      confidence: 'high',
      match,
      index,
    });
    const serialized = JSON.stringify(finding);
    expect(serialized).not.toContain(match);
    expect(finding.redactedPreview).not.toBe(match);
  });

  it('supports file-level findings with no match', () => {
    const ctx = createDetectionContext({ path: 'id_rsa', content: '' });
    const finding = ctx.finding({
      detectorId: 'filename',
      detectorKind: 'filename',
      title: 'SSH private key file',
      category: 'ssh-key',
      severity: 'high',
      confidence: 'high',
    });
    expect(finding.length).toBe(0);
    expect(finding.redactedPreview).toBe('<REDACTED>');
    expect(finding.line).toBeUndefined();
    expect(finding.index).toBeUndefined();
  });

  it('produces stable fingerprints for identical inputs', () => {
    const ctx = createDetectionContext({ path: 'a.txt', content });
    const spec = {
      detectorId: 'openai',
      title: 'OpenAI API key',
      category: 'api-key' as const,
      severity: 'critical' as const,
      confidence: 'high' as const,
      match,
      index,
    };
    expect(ctx.finding(spec).fingerprint).toBe(ctx.finding(spec).fingerprint);
  });
});
