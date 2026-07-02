/**
 * Value masking primitives.
 *
 * These are used to build the *previews* that appear in findings, reports, and
 * logs. They must NEVER return the full original value. This is a hard security
 * invariant of Guardrails - everything downstream trusts that a preview is safe
 * to display and store.
 */

/** The canonical placeholder used when a value is fully redacted. */
export const REDACTED = '<REDACTED>';

export interface MaskOptions {
  /** Number of leading characters to reveal. Default 3. */
  revealStart?: number;
  /** Number of trailing characters to reveal. Default 0. */
  revealEnd?: number;
  /** Character used for masking. Default '*'. */
  maskChar?: string;
  /** Cap on the run of mask characters shown, to avoid leaking exact length. Default 8. */
  maxMaskLength?: number;
}

/**
 * Return a masked preview of `value` that is always safe to display.
 *
 * Guarantees:
 * - The full value is never returned (there is always at least one masked char
 *   for any non-empty input, unless the whole thing is masked).
 * - No more than ~40% of the characters are ever revealed.
 * - Very short values (≤ 4 chars) are fully masked, since revealing part of them
 *   would leak most of the secret.
 */
export function maskSecret(value: string, options: MaskOptions = {}): string {
  const maskChar = options.maskChar ?? '*';
  const maxMaskLength = options.maxMaskLength ?? 8;
  const len = value.length;

  if (len === 0) return '';
  if (len <= 4) {
    return maskChar.repeat(Math.min(len, maxMaskLength));
  }

  // Never reveal more than ~40% of the value across both ends.
  const maxReveal = Math.max(1, Math.floor(len * 0.4));
  let start = Math.min(Math.max(options.revealStart ?? 3, 0), maxReveal);
  let end = Math.min(Math.max(options.revealEnd ?? 0, 0), Math.max(0, maxReveal - start));

  // Always leave at least one masked character.
  if (start + end >= len) {
    start = Math.min(start, len - 1);
    end = 0;
  }

  const hiddenCount = len - start - end;
  const maskRun = maskChar.repeat(Math.min(hiddenCount, maxMaskLength));
  const head = value.slice(0, start);
  const tail = end > 0 ? value.slice(len - end) : '';
  return head + maskRun + tail;
}

/**
 * Build a short, safe preview label for a finding, e.g. `sk-********`.
 * Adds an ellipsis when the mask run was truncated so the reader knows the value
 * is longer than shown.
 */
export function previewSecret(value: string, options: MaskOptions = {}): string {
  const masked = maskSecret(value, options);
  const maxMaskLength = options.maxMaskLength ?? 8;
  const revealed = (options.revealStart ?? 3) + (options.revealEnd ?? 0);
  if (value.length - revealed > maxMaskLength) {
    return `${masked}…`;
  }
  return masked;
}
