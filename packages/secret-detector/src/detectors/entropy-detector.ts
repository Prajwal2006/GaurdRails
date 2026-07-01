import type { DetectionContext, Detector, Finding } from '@guardrails/shared';
import { characterClasses, shannonEntropy, tokenize } from '../entropy.js';

export interface EntropyDetectorOptions {
  /** Minimum token length to consider. Default 20. */
  minLength?: number;
  /** Maximum token length (longer tokens are likely encoded blobs). Default 200. */
  maxLength?: number;
  /** Minimum Shannon entropy (bits/char) to flag. Default 4.0. */
  threshold?: number;
  /** Tokens matching any of these are never flagged. */
  allowlist?: readonly RegExp[];
}

const DEFAULT_ALLOWLIST: readonly RegExp[] = [
  // UUIDs
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  // Subresource-integrity / package-lock hashes
  /^(?:sha\d{3}|md5)-/i,
];

/**
 * Format-agnostic detector: flags random-looking, high-entropy strings that may
 * be secrets even when no rule recognises them. Deliberately conservative to
 * keep false positives low — pure hex (hashes), pure digits, low-variety tokens,
 * and allowlisted patterns are skipped, and matches are reported at low
 * confidence so policy can treat them gently.
 */
export function entropyDetector(options: EntropyDetectorOptions = {}): Detector {
  const minLength = options.minLength ?? 20;
  const maxLength = options.maxLength ?? 200;
  const threshold = options.threshold ?? 4.0;
  const allowlist = options.allowlist ?? DEFAULT_ALLOWLIST;

  return {
    id: 'entropy',
    title: 'High-entropy string',
    kind: 'entropy',
    description: 'Flags random-looking strings that may be secrets, regardless of format.',
    detect(ctx: DetectionContext): Finding[] {
      const findings: Finding[] = [];
      for (const { value, index } of tokenize(ctx.content)) {
        if (value.length < minLength || value.length > maxLength) continue;
        if (/^[0-9a-f]+$/i.test(value)) continue; // pure hex → usually a hash/id
        if (/^[0-9]+$/.test(value)) continue; // pure digits
        if (characterClasses(value) < 3) continue; // require a real mix
        if (allowlist.some((re) => re.test(value))) continue;
        if (shannonEntropy(value) < threshold) continue;

        findings.push(
          ctx.finding({
            detectorId: 'entropy',
            detectorKind: 'entropy',
            title: 'High-entropy string (possible secret)',
            category: 'generic-secret',
            severity: 'medium',
            confidence: 'low',
            match: value,
            index,
            explanationId: 'high-entropy',
          }),
        );
      }
      return findings;
    },
  };
}
