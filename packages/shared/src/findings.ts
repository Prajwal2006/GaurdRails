import type { Confidence, Severity } from './severity.js';

/** How a detector arrived at a match. */
export const DETECTOR_KINDS = ['filename', 'regex', 'structural', 'entropy', 'custom'] as const;
export type DetectorKind = (typeof DETECTOR_KINDS)[number];

/** Broad classification of what a finding represents. Drives policy & education. */
export const SECRET_CATEGORIES = [
  'api-key',
  'private-key',
  'certificate',
  'jwt',
  'connection-string',
  'password',
  'token',
  'cookie',
  'cloud-credentials',
  'ssh-key',
  'oauth',
  'generic-secret',
  'sensitive-file',
] as const;
export type SecretCategory = (typeof SECRET_CATEGORIES)[number];

/**
 * A single detected risk. A `Finding` NEVER contains the raw secret value - only
 * its location, a classification, and a masked preview. This is a load-bearing
 * security property: findings are logged, reported, and displayed, so they must
 * be safe to persist.
 */
export interface Finding {
  /** The detector that produced this finding. */
  readonly detectorId: string;
  readonly detectorKind: DetectorKind;
  /** Human-readable title, e.g. "OpenAI API key". */
  readonly title: string;
  readonly category: SecretCategory;
  readonly severity: Severity;
  readonly confidence: Confidence;
  /** Path of the file the finding was found in, when known. */
  readonly path?: string;
  /** 1-based line number of the match within the content, when applicable. */
  readonly line?: number;
  /** 1-based column number of the match within the content, when applicable. */
  readonly column?: number;
  /** 0-based character offset of the match within the content, when applicable. */
  readonly index?: number;
  /** Length in characters of the matched value (location, not the value itself). */
  readonly length: number;
  /** A masked, display-safe preview of the value, e.g. `sk-********`. */
  readonly redactedPreview: string;
  /** Stable identifier for de-duplication. Derived from location + detector, never the value. */
  readonly fingerprint: string;
  /** Optional link into the educational content catalog. */
  readonly explanationId?: string;
}

/** A findings-only summary safe for audit logs (no preview, no value). */
export interface FindingSummary {
  readonly detectorId: string;
  readonly category: SecretCategory;
  readonly severity: Severity;
  readonly line?: number;
}

export function toFindingSummary(finding: Finding): FindingSummary {
  const summary: FindingSummary = {
    detectorId: finding.detectorId,
    category: finding.category,
    severity: finding.severity,
  };
  return finding.line === undefined ? summary : { ...summary, line: finding.line };
}
