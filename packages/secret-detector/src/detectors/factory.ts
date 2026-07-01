import type {
  Confidence,
  DetectionContext,
  Detector,
  DetectorKind,
  Finding,
  SecretCategory,
  Severity,
} from '@guardrails/shared';

/** Declarative description of a regex-based detector. */
export interface RegexRule {
  readonly id: string;
  readonly title: string;
  readonly category: SecretCategory;
  readonly severity: Severity;
  readonly confidence: Confidence;
  /** The pattern to search for. `g`/`d` flags are added automatically. */
  readonly pattern: RegExp;
  /** Which capture group is the actual secret. Default 0 (the whole match). */
  readonly group?: number;
  /** Kind reported on the finding. Default `regex`. */
  readonly kind?: DetectorKind;
  /** Wrap the pattern in non-word boundaries so it can't match mid-token. Default true. */
  readonly boundary?: boolean;
  readonly explanationId?: string;
  readonly description?: string;
  /** Optional post-filter to suppress false positives. */
  readonly validate?: (value: string, fullMatch: string) => boolean;
}

interface WithIndices {
  indices?: Array<[number, number] | undefined>;
}

/** Build a `Detector` from a declarative regex rule. */
export function makeRegexDetector(rule: RegexRule): Detector {
  const group = rule.group ?? 0;
  const kind = rule.kind ?? 'regex';
  const boundary = rule.boundary ?? true;
  const core = boundary ? `(?<![\\w-])(?:${rule.pattern.source})(?![\\w-])` : rule.pattern.source;
  const flags = `${rule.pattern.flags.replace(/[gd]/g, '')}gd`;

  const detector: Detector = {
    id: rule.id,
    title: rule.title,
    kind,
    ...(rule.description !== undefined ? { description: rule.description } : {}),
    detect(ctx: DetectionContext): Finding[] {
      const re = new RegExp(core, flags);
      const findings: Finding[] = [];
      for (const match of ctx.content.matchAll(re)) {
        const value = match[group];
        if (value === undefined) continue;
        if (rule.validate && !rule.validate(value, match[0])) continue;
        const indices = (match as unknown as WithIndices).indices;
        const start = indices?.[group]?.[0] ?? match.index ?? 0;
        findings.push(
          ctx.finding({
            detectorId: rule.id,
            detectorKind: kind,
            title: rule.title,
            category: rule.category,
            severity: rule.severity,
            confidence: rule.confidence,
            match: value,
            index: start,
            ...(rule.explanationId !== undefined ? { explanationId: rule.explanationId } : {}),
          }),
        );
      }
      return findings;
    },
  };
  return detector;
}

export function makeRegexDetectors(rules: readonly RegexRule[]): Detector[] {
  return rules.map(makeRegexDetector);
}
