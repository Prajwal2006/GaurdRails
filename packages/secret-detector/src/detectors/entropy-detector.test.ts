import { describe, expect, it } from 'vitest';
import { createDetectionContext } from '@guardrails/shared';
import type { Finding } from '@guardrails/shared';
import { entropyDetector } from './entropy-detector.js';

function scan(content: string, options?: Parameters<typeof entropyDetector>[0]): Finding[] {
  return entropyDetector(options).detect(createDetectionContext({ content }));
}

const RANDOM = 'Xk9Qm2Lp7Rt4Vz8Nw1Bc6Df3Gh5Jk0Ys';

describe('entropyDetector', () => {
  it('flags a random-looking, mixed-class token', () => {
    const [finding] = scan(`token = ${RANDOM}`);
    expect(finding?.category).toBe('generic-secret');
    expect(finding?.confidence).toBe('low');
  });

  const ignored: ReadonlyArray<[string, string]> = [
    ['a git sha (pure hex)', 'da39a3ee5e6b4b0d3255bfef95601890afd80709'],
    ['a UUID', '550e8400-e29b-41d4-a716-446655440000'],
    ['pure digits', '12345678901234567890'],
    ['low-variety letters', 'abcdefghijklmnopqrstuvwxyzabcd'],
    ['prose', 'the quick brown fox jumps over the lazy dog'],
  ];

  for (const [name, content] of ignored) {
    it(`does not flag ${name}`, () => {
      expect(scan(content)).toHaveLength(0);
    });
  }

  it('respects a raised entropy threshold', () => {
    expect(scan(RANDOM, { threshold: 8 })).toHaveLength(0);
  });

  it('respects a custom allowlist', () => {
    expect(scan(RANDOM, { allowlist: [/^Xk9Qm2/] })).toHaveLength(0);
  });

  it('respects minLength', () => {
    expect(scan(RANDOM, { minLength: 100 })).toHaveLength(0);
  });
});
