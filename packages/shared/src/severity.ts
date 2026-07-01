/** Severity and confidence scales shared across detection and policy. */

export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ['low', 'medium', 'high'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Numeric rank for a severity (higher = more severe). */
export function severityRank(severity: Severity): number {
  return SEVERITY_RANK[severity];
}

/**
 * Compare two severities. Returns a negative number if `a` is less severe than
 * `b`, positive if more severe, and 0 if equal - suitable for `Array#sort`.
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b];
}

/** The more severe of two severities. */
export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** True when `severity` is at least as severe as `threshold`. */
export function meetsSeverity(severity: Severity, threshold: Severity): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[threshold];
}

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function compareConfidence(a: Confidence, b: Confidence): number {
  return CONFIDENCE_RANK[a] - CONFIDENCE_RANK[b];
}
