import type { DetectionContext, Detector, Finding } from '@guardrails/shared';

// A key name that implies a secret: `API_KEY`, `db_password`, `clientSecret`…
const KEY_PART =
  '(?:[A-Za-z0-9_.-]*)(?:secret|token|passphrase|passwd|password|pwd|api[_-]?key|apikey|access[_-]?key|auth[_-]?token|client[_-]?secret|private[_-]?key|credentials?)';

const ASSIGNMENT = new RegExp(
  `(?<![\\w.])(${KEY_PART})\\s*[:=]\\s*(?:"([^"\\n]{4,})"|'([^'\\n]{4,})'|([^\\s"'\`#,;]{4,}))`,
  'gid',
);

// Values that are obviously not real secrets (env refs, placeholders, literals).
const PLACEHOLDER =
  /^(?:process\.env|import\.meta|os\.environ|env\.|<[^>]*>|\$\{?[\w.]+\}?|%[\w.]+%|your[-_ ]|example|changeme|change[-_]?me|placeholder|redacted|xxx+|todo|none|null|nil|undefined|true|false|\.\.\.|\*{2,}|-{2,})/i;

interface WithIndices {
  indices?: Array<[number, number] | undefined>;
}

/**
 * Detects `KEY = value` assignments where the key name implies a secret. This is
 * the safety net that catches things no provider rule knows about - a database
 * password, a bespoke internal token, a passphrase - regardless of filename.
 */
export const keywordAssignmentDetector: Detector = {
  id: 'keyword-assignment',
  title: 'Hard-coded secret assignment',
  kind: 'custom',
  description: 'Flags KEY = value assignments where the key name implies a secret.',
  detect(ctx: DetectionContext): Finding[] {
    const findings: Finding[] = [];
    const re = new RegExp(ASSIGNMENT.source, ASSIGNMENT.flags);
    for (const match of ctx.content.matchAll(re)) {
      const keyName = match[1] ?? '';
      let group = -1;
      if (match[2] !== undefined) group = 2;
      else if (match[3] !== undefined) group = 3;
      else if (match[4] !== undefined) group = 4;
      if (group === -1) continue;

      const value = match[group];
      if (value === undefined) continue;
      const trimmed = value.trim();
      if (trimmed.length < 6) continue;
      if (PLACEHOLDER.test(trimmed)) continue;
      if (!/[A-Za-z0-9]/.test(trimmed)) continue;

      const indices = (match as unknown as WithIndices).indices;
      const start = indices?.[group]?.[0] ?? match.index ?? 0;
      const isPassword = /pass|pwd|passphrase/i.test(keyName);

      findings.push(
        ctx.finding({
          detectorId: 'keyword-assignment',
          detectorKind: 'custom',
          title: isPassword ? 'Hard-coded password' : 'Hard-coded secret',
          category: isPassword ? 'password' : 'generic-secret',
          severity: 'medium',
          confidence: 'medium',
          match: value,
          index: start,
          explanationId: 'hardcoded-secret',
        }),
      );
    }
    return findings;
  },
};
