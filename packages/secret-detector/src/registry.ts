import {
  compareSeverity,
  createDetectionContext,
  severityRank,
  type DetectionInput,
  type Detector,
  type DetectorKind,
  type Finding,
  type Severity,
} from '@guardrails/shared';
import { filenameDetector } from './detectors/filename.js';
import { providerDetectors } from './detectors/providers.js';
import { structuralDetectors } from './detectors/structural.js';
import { keywordAssignmentDetector } from './detectors/keyword-assignment.js';
import { entropyDetector } from './detectors/entropy-detector.js';

/** The full set of detectors enabled by default. */
export function defaultDetectors(): Detector[] {
  return [
    filenameDetector,
    ...providerDetectors,
    ...structuralDetectors,
    keywordAssignmentDetector,
    entropyDetector(),
  ];
}

const SPECIFIC_KINDS: ReadonlySet<DetectorKind> = new Set(['regex', 'structural']);
const GENERIC_KINDS: ReadonlySet<DetectorKind> = new Set(['custom', 'entropy']);

function strength(finding: Finding): number {
  const confidence = finding.confidence === 'high' ? 2 : finding.confidence === 'medium' ? 1 : 0;
  return severityRank(finding.severity) * 3 + confidence;
}

function isStronger(a: Finding, b: Finding): boolean {
  return strength(a) > strength(b);
}

function overlaps(a: Finding, b: Finding): boolean {
  if (a.index === undefined || b.index === undefined) return false;
  const aEnd = a.index + a.length;
  const bEnd = b.index + b.length;
  return a.index < bEnd && b.index < aEnd;
}

/**
 * Reduce raw detector output into a clean, ordered list:
 * 1. de-duplicate identical findings, keeping the strongest;
 * 2. suppress low-specificity findings (entropy/keyword) that overlap a precise
 *    provider/structural match, so a single key isn't reported three ways;
 * 3. sort by line, then severity (desc), then column.
 */
export function finalizeFindings(findings: readonly Finding[]): Finding[] {
  const byFingerprint = new Map<string, Finding>();
  for (const finding of findings) {
    const existing = byFingerprint.get(finding.fingerprint);
    if (existing === undefined || isStronger(finding, existing)) {
      byFingerprint.set(finding.fingerprint, finding);
    }
  }

  let list = [...byFingerprint.values()];
  const specific = list.filter((f) => SPECIFIC_KINDS.has(f.detectorKind));
  if (specific.length > 0) {
    list = list.filter(
      (f) => !GENERIC_KINDS.has(f.detectorKind) || !specific.some((s) => overlaps(f, s)),
    );
  }

  list.sort(
    (a, b) =>
      (a.line ?? 0) - (b.line ?? 0) ||
      compareSeverity(b.severity, a.severity) ||
      (a.column ?? 0) - (b.column ?? 0),
  );
  return list;
}

export interface ScanSummary {
  readonly total: number;
  readonly bySeverity: Readonly<Record<Severity, number>>;
  readonly highestSeverity: Severity | undefined;
}

/** Aggregate counts for a set of findings. */
export function summarizeFindings(findings: readonly Finding[]): ScanSummary {
  const bySeverity: Record<Severity, number> = {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  let highest: Severity | undefined;
  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
    if (highest === undefined || severityRank(finding.severity) > severityRank(highest)) {
      highest = finding.severity;
    }
  }
  return { total: findings.length, bySeverity, highestSeverity: highest };
}

export interface RegistryOptions {
  readonly disable?: readonly string[];
}

/**
 * A mutable collection of detectors. Register your own to extend Guardrails; the
 * registry runs them all over a piece of content and returns a clean finding
 * list. Detectors that throw are isolated - a broken detector can never crash a
 * scan (fail-safe).
 */
export class DetectorRegistry {
  private readonly detectors = new Map<string, Detector>();

  constructor(detectors: readonly Detector[] = []) {
    for (const detector of detectors) this.register(detector);
  }

  /** A registry pre-loaded with all built-in detectors. */
  static withDefaults(options: RegistryOptions = {}): DetectorRegistry {
    const registry = new DetectorRegistry(defaultDetectors());
    for (const id of options.disable ?? []) registry.unregister(id);
    return registry;
  }

  register(detector: Detector): this {
    this.detectors.set(detector.id, detector);
    return this;
  }

  unregister(id: string): this {
    this.detectors.delete(id);
    return this;
  }

  has(id: string): boolean {
    return this.detectors.has(id);
  }

  list(): Detector[] {
    return [...this.detectors.values()];
  }

  get size(): number {
    return this.detectors.size;
  }

  /** Run every detector over the input and return a clean, ordered finding list. */
  scan(input: DetectionInput): Finding[] {
    const ctx = createDetectionContext(input);
    const collected: Finding[] = [];
    for (const detector of this.detectors.values()) {
      try {
        collected.push(...detector.detect(ctx));
      } catch {
        // Fail safe: never let a misbehaving detector break the scan.
      }
    }
    return finalizeFindings(collected);
  }
}
