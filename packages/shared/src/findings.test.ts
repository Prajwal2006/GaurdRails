import { describe, expect, it } from 'vitest';
import { toFindingSummary, type Finding } from './findings.js';

const base: Finding = {
  detectorId: 'openai-api-key',
  detectorKind: 'regex',
  title: 'OpenAI API key',
  category: 'api-key',
  severity: 'critical',
  confidence: 'high',
  length: 20,
  redactedPreview: 'sk-***',
  fingerprint: 'abc12345',
};

describe('toFindingSummary', () => {
  it('keeps only value-free metadata', () => {
    const summary = toFindingSummary({ ...base, line: 7 });
    expect(summary).toEqual({
      detectorId: 'openai-api-key',
      category: 'api-key',
      severity: 'critical',
      line: 7,
    });
  });

  it('omits line when absent', () => {
    const summary = toFindingSummary(base);
    expect('line' in summary).toBe(false);
  });

  it('never carries a preview or raw value', () => {
    const summary = toFindingSummary({ ...base, line: 1 });
    expect(JSON.stringify(summary)).not.toContain('sk-');
  });
});
