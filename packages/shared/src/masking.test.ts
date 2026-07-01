import { describe, expect, it } from 'vitest';
import { maskSecret, previewSecret, REDACTED } from './masking.js';

describe('maskSecret', () => {
  it('returns empty string for empty input', () => {
    expect(maskSecret('')).toBe('');
  });

  it('fully masks very short values (<= 4 chars)', () => {
    expect(maskSecret('a')).toBe('*');
    expect(maskSecret('ab')).toBe('**');
    expect(maskSecret('abcd')).toBe('****');
  });

  it('never returns the full original value', () => {
    const samples = [
      'sk-abc123def456ghi789',
      'AKIAIOSFODNN7EXAMPLE',
      'ghp_1234567890abcdefABCDEF1234567890abcd',
      'password123',
      'x'.repeat(200),
    ];
    for (const value of samples) {
      expect(maskSecret(value)).not.toBe(value);
      expect(maskSecret(value, { revealStart: 4, revealEnd: 4 })).not.toBe(value);
    }
  });

  it('reveals no more than ~40% of the value', () => {
    const value = 'abcdefghij'; // 10 chars
    const masked = maskSecret(value, { revealStart: 8, revealEnd: 8 });
    const revealedChars = masked.replace(/\*/g, '').length;
    expect(revealedChars).toBeLessThanOrEqual(4);
  });

  it('reveals a recognizable prefix by default', () => {
    expect(maskSecret('sk-abcdefghijklmnop')).toMatch(/^sk-\*+$/);
  });

  it('caps the mask run so exact length is not leaked', () => {
    const masked = maskSecret('x'.repeat(500), { revealStart: 2 });
    const stars = masked.replace(/[^*]/g, '').length;
    expect(stars).toBeLessThanOrEqual(8);
  });

  it('can reveal a suffix when asked', () => {
    const masked = maskSecret('abcdefghijklmnop', { revealStart: 2, revealEnd: 2 });
    expect(masked.startsWith('ab')).toBe(true);
    expect(masked.endsWith('op')).toBe(true);
    expect(masked).not.toBe('abcdefghijklmnop');
  });

  it('always leaves at least one masked character', () => {
    const masked = maskSecret('abcde', { revealStart: 100, revealEnd: 100 });
    expect(masked).toContain('*');
  });

  it('respects a custom mask character', () => {
    expect(maskSecret('abcdefgh', { revealStart: 2, maskChar: '#' })).toMatch(/^ab#+$/);
  });
});

describe('previewSecret', () => {
  it('adds an ellipsis when the value is longer than the shown mask', () => {
    expect(previewSecret('sk-' + 'x'.repeat(40))).toMatch(/…$/);
  });

  it('omits the ellipsis for short values', () => {
    expect(previewSecret('sk-abcd')).not.toMatch(/…$/);
  });
});

describe('REDACTED', () => {
  it('is the canonical placeholder', () => {
    expect(REDACTED).toBe('<REDACTED>');
  });
});
