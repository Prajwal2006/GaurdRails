import { describe, expect, it } from 'vitest';
import { SECRET_CATEGORIES, renderExplanation, type Finding } from '@guardrails/shared';
import { defaultCatalog, explainFinding, resolveExplanation } from './education.js';

function findingOf(category: (typeof SECRET_CATEGORIES)[number]): Finding {
  return {
    detectorId: 'x',
    detectorKind: 'regex',
    title: 't',
    category,
    severity: 'high',
    confidence: 'high',
    length: 1,
    redactedPreview: 'p',
    fingerprint: 'f',
  };
}

describe('education catalog', () => {
  it('has an explanation for every secret category', () => {
    for (const category of SECRET_CATEGORIES) {
      const explanation = explainFinding(findingOf(category));
      expect(explanation.id).toBe(category);
      expect(explanation.fix.length).toBeGreaterThan(0);
      expect(explanation.prevent.length).toBeGreaterThan(0);
    }
    expect(defaultCatalog.all()).toHaveLength(SECRET_CATEGORIES.length);
  });

  it('renders per experience level', () => {
    const rendered = renderExplanation(explainFinding(findingOf('api-key')), 'beginner');
    expect(rendered.what.length).toBeGreaterThan(0);
    expect(rendered.why.length).toBeGreaterThan(0);
  });

  it('resolves categories, ids, and aliases', () => {
    expect(resolveExplanation('api-key')?.id).toBe('api-key');
    expect(resolveExplanation('openai')?.id).toBe('api-key');
    expect(resolveExplanation('AWS')?.id).toBe('cloud-credentials');
    expect(resolveExplanation('postgres')?.id).toBe('connection-string');
    expect(resolveExplanation('ssh')?.id).toBe('ssh-key');
    expect(resolveExplanation('dotenv')?.id).toBe('sensitive-file');
  });

  it('returns undefined for unknown terms', () => {
    expect(resolveExplanation('banana')).toBeUndefined();
  });

  it('exposes get() on the catalog', () => {
    expect(defaultCatalog.get('jwt')?.title).toContain('JWT');
    expect(defaultCatalog.get('nope')).toBeUndefined();
  });
});
