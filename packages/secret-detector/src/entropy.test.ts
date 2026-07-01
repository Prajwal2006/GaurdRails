import { describe, expect, it } from 'vitest';
import { characterClasses, shannonEntropy, tokenize } from './entropy.js';

describe('shannonEntropy', () => {
  it('is 0 for empty and single-character strings', () => {
    expect(shannonEntropy('')).toBe(0);
    expect(shannonEntropy('aaaa')).toBe(0);
  });

  it('is 1 bit/char for a two-symbol uniform string', () => {
    expect(shannonEntropy('abab')).toBeCloseTo(1, 5);
  });

  it('is higher for random-looking strings than for prose', () => {
    const random = shannonEntropy('Xk9Qm2Lp7Rt4Vz8Nw1Bc6Df3');
    const prose = shannonEntropy('the quick brown fox jumps');
    expect(random).toBeGreaterThan(prose);
  });
});

describe('characterClasses', () => {
  it('counts lower, upper, digit and symbol classes', () => {
    expect(characterClasses('abc')).toBe(1);
    expect(characterClasses('abcABC')).toBe(2);
    expect(characterClasses('abcABC123')).toBe(3);
    expect(characterClasses('abcABC123$!')).toBe(4);
  });
});

describe('tokenize', () => {
  it('yields secret-like tokens with their offsets', () => {
    const content = 'key = abcdefgh12345678';
    const tokens = [...tokenize(content)];
    expect(tokens.map((t) => t.value)).toContain('abcdefgh12345678');
    const token = tokens.find((t) => t.value === 'abcdefgh12345678');
    expect(content.slice(token!.index, token!.index + token!.value.length)).toBe(
      'abcdefgh12345678',
    );
  });

  it('accepts a custom non-global pattern and still iterates', () => {
    const tokens = [...tokenize('aaaaaaaa bbbbbbbb', /[a-z]{8}/)];
    expect(tokens).toHaveLength(2);
  });
});
