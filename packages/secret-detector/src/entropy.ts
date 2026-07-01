/**
 * Shannon entropy utilities. Entropy is measured in bits per character: a value
 * whose characters are close to uniformly random (like a base64 API key) has
 * high entropy, whereas English prose or a repeated string has low entropy.
 */

/** Shannon entropy of a string in bits per character. */
export function shannonEntropy(input: string): number {
  if (input.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of input) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  const len = input.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Number of distinct character classes present (lower, upper, digit, symbol). */
export function characterClasses(input: string): number {
  let classes = 0;
  if (/[a-z]/.test(input)) classes += 1;
  if (/[A-Z]/.test(input)) classes += 1;
  if (/[0-9]/.test(input)) classes += 1;
  if (/[^A-Za-z0-9]/.test(input)) classes += 1;
  return classes;
}

export interface Token {
  readonly value: string;
  readonly index: number;
}

/**
 * Yield candidate secret-like tokens from content, with their start offset.
 * The default pattern matches runs of characters that appear in base64/base62
 * secrets (letters, digits, and `+/=_-`).
 */
export function* tokenize(
  content: string,
  pattern = /[A-Za-z0-9+/=_-]{8,}/g,
): Generator<Token, void, unknown> {
  const re = pattern.flags.includes('g')
    ? pattern
    : new RegExp(pattern.source, `${pattern.flags}g`);
  for (const match of content.matchAll(re)) {
    if (match.index === undefined) continue;
    yield { value: match[0], index: match.index };
  }
}
