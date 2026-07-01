import { describe, expect, it } from 'vitest';
import type { Detector, Finding } from '@guardrails/shared';
import {
  DetectorRegistry,
  defaultDetectors,
  finalizeFindings,
  summarizeFindings,
} from './registry.js';

const OPENAI = 'sk-Ab1Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2Yz34';

describe('DetectorRegistry.withDefaults', () => {
  it('loads all built-in detectors', () => {
    const registry = DetectorRegistry.withDefaults();
    expect(registry.size).toBeGreaterThan(10);
    expect(registry.has('filename')).toBe(true);
    expect(registry.has('openai-api-key')).toBe(true);
    expect(registry.has('entropy')).toBe(true);
  });

  it('can disable detectors by id', () => {
    const registry = DetectorRegistry.withDefaults({ disable: ['entropy'] });
    expect(registry.has('entropy')).toBe(false);
  });
});

describe('DetectorRegistry.scan', () => {
  it('finds multiple kinds of secrets in one document', () => {
    const content = [
      'OPENAI_API_KEY=' + OPENAI,
      'DB_PASSWORD=SuperSecretValue123',
      'url = postgres://admin:s3cr3t@db.example.com/app',
    ].join('\n');
    const findings = DetectorRegistry.withDefaults().scan({ path: 'config.ts', content });
    const categories = new Set(findings.map((f) => f.category));
    expect(categories).toContain('api-key');
    expect(categories).toContain('password');
    expect(categories).toContain('connection-string');
  });

  it('suppresses entropy/keyword findings that overlap a precise match', () => {
    // The OpenAI key would also look high-entropy and sits in a KEY=value pair,
    // but only the precise provider finding should survive.
    const findings = DetectorRegistry.withDefaults().scan({
      path: 'config.ts',
      content: 'OPENAI_API_KEY=' + OPENAI,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detectorId).toBe('openai-api-key');
  });

  it('combines a filename finding with content findings', () => {
    const findings = DetectorRegistry.withDefaults().scan({
      path: '.env',
      content: 'DB_PASSWORD=SuperSecretValue123',
    });
    const ids = findings.map((f) => f.detectorId);
    expect(ids).toContain('filename:dotenv');
    expect(ids).toContain('keyword-assignment');
  });

  it('returns nothing for benign content', () => {
    const findings = DetectorRegistry.withDefaults().scan({
      path: 'index.ts',
      content: 'export const greeting = "hello world";\n',
    });
    expect(findings).toHaveLength(0);
  });

  it('sorts findings by line then severity', () => {
    const content = 'line one is clean\nDB_PASSWORD=SuperSecretValue123\n' + OPENAI;
    const findings = DetectorRegistry.withDefaults().scan({ path: 'x.ts', content });
    const lines = findings.map((f) => f.line ?? 0);
    const sorted = [...lines].sort((a, b) => a - b);
    expect(lines).toEqual(sorted);
  });

  it('isolates a throwing detector (fail-safe)', () => {
    const broken: Detector = {
      id: 'broken',
      title: 'Broken',
      kind: 'custom',
      detect() {
        throw new Error('boom');
      },
    };
    const registry = DetectorRegistry.withDefaults().register(broken);
    const findings = registry.scan({ path: 'config.ts', content: 'OPENAI_API_KEY=' + OPENAI });
    expect(findings.map((f) => f.detectorId)).toContain('openai-api-key');
  });

  it('never leaks a raw secret in its output', () => {
    const findings = DetectorRegistry.withDefaults().scan({ path: 'config.ts', content: OPENAI });
    expect(JSON.stringify(findings)).not.toContain(OPENAI);
  });
});

describe('registry management', () => {
  it('register / unregister / has / list', () => {
    const custom: Detector = { id: 'x', title: 'X', kind: 'custom', detect: () => [] };
    const registry = new DetectorRegistry();
    expect(registry.size).toBe(0);
    registry.register(custom);
    expect(registry.has('x')).toBe(true);
    expect(registry.list().map((d) => d.id)).toEqual(['x']);
    registry.unregister('x');
    expect(registry.has('x')).toBe(false);
  });

  it('defaultDetectors returns a fresh array each call', () => {
    expect(defaultDetectors()).not.toBe(defaultDetectors());
  });
});

describe('finalizeFindings', () => {
  it('de-duplicates identical fingerprints', () => {
    const base: Finding = {
      detectorId: 'openai-api-key',
      detectorKind: 'regex',
      title: 'OpenAI API key',
      category: 'api-key',
      severity: 'critical',
      confidence: 'high',
      length: 10,
      redactedPreview: 'sk-***',
      fingerprint: 'same',
      index: 0,
      line: 1,
      column: 1,
    };
    expect(finalizeFindings([base, { ...base }])).toHaveLength(1);
  });
});

describe('summarizeFindings', () => {
  it('counts findings by severity and reports the highest', () => {
    const findings = DetectorRegistry.withDefaults().scan({
      path: 'config.ts',
      content: 'OPENAI_API_KEY=' + OPENAI,
    });
    const summary = summarizeFindings(findings);
    expect(summary.total).toBe(1);
    expect(summary.highestSeverity).toBe('critical');
    expect(summary.bySeverity.critical).toBe(1);
  });

  it('handles an empty finding list', () => {
    const summary = summarizeFindings([]);
    expect(summary.total).toBe(0);
    expect(summary.highestSeverity).toBeUndefined();
  });
});
