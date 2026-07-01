import {
  maskSecret,
  previewSecret,
  REDACTED,
  type Finding,
  type MaskOptions,
} from '@guardrails/shared';

export interface RedactionOptions {
  /** The replacement token used for a fully-redacted value. Default `<REDACTED>`. */
  token?: string;
  /**
   * When true, replace a value with a masked preview (e.g. `sk-********`) instead
   * of a flat token, so the reader keeps a hint of what was there. Off by default
   * because a flat token leaks strictly less.
   */
  preservePreview?: boolean;
  /** Masking options used when `preservePreview` is true. */
  mask?: MaskOptions;
  /** Optional per-finding token override. Return undefined to fall back. */
  tokenFor?: (finding: Finding) => string | undefined;
}

export interface RedactionResult {
  /** The content with every redactable finding replaced. */
  readonly content: string;
  /** How many spans were redacted. */
  readonly redactions: number;
}

interface Span {
  readonly start: number;
  readonly end: number;
  readonly finding: Finding;
}

/**
 * Replace every detected secret span in `content` with a redaction token,
 * preserving the surrounding structure (so `KEY=secret` becomes
 * `KEY=<REDACTED>`). Overlapping findings are collapsed. File-level findings
 * (those without a content location) are ignored here — there is nothing in the
 * text to replace.
 *
 * Security invariant: the returned content never contains the original value of
 * any redacted span.
 */
export function redactContent(
  content: string,
  findings: readonly Finding[],
  options: RedactionOptions = {},
): RedactionResult {
  const token = options.token ?? REDACTED;

  const spans: Span[] = [];
  for (const finding of findings) {
    if (finding.index === undefined || finding.length <= 0) continue;
    spans.push({ start: finding.index, end: finding.index + finding.length, finding });
  }
  spans.sort((a, b) => a.start - b.start);

  let result = '';
  let cursor = 0;
  let redactions = 0;

  for (const span of spans) {
    if (span.start < cursor) continue; // already covered by a previous span
    result += content.slice(cursor, span.start);
    const original = content.slice(span.start, span.end);
    result += replacementFor(span.finding, original, token, options);
    cursor = span.end;
    redactions += 1;
  }
  result += content.slice(cursor);

  return { content: result, redactions };
}

function replacementFor(
  finding: Finding,
  original: string,
  token: string,
  options: RedactionOptions,
): string {
  const custom = options.tokenFor?.(finding);
  if (custom !== undefined) return custom;
  if (options.preservePreview) return previewSecret(original, options.mask);
  return token;
}

/** Fully mask a standalone value. Convenience wrapper over the shared primitive. */
export function redactValue(
  value: string,
  options: { preview?: boolean; mask?: MaskOptions } = {},
): string {
  if (options.preview) return previewSecret(value, options.mask);
  return options.mask ? maskSecret(value, options.mask) : REDACTED;
}

/** A configured redactor, handy when the same options are reused. */
export class Redactor {
  constructor(private readonly options: RedactionOptions = {}) {}

  redact(content: string, findings: readonly Finding[]): RedactionResult {
    return redactContent(content, findings, this.options);
  }
}
