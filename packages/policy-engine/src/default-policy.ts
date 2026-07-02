import type { Policy } from '@guardrails/shared';

/**
 * The built-in fail-safe policy. Philosophy: AI should have access to code, not
 * secrets. So known-sensitive files and high-severity findings are denied,
 * ambiguous medium findings are redacted (still useful to the AI, minus the
 * secret), low-severity findings are audited, and everything else - ordinary
 * code with no findings - is allowed.
 */
export function createDefaultPolicy(): Policy {
  return {
    id: 'default',
    description: 'Fail-safe defaults: protect sensitive content, redact ambiguous, allow code.',
    defaultAction: 'allow',
    rules: [
      {
        id: 'deny-sensitive-categories',
        description: 'Sensitive files and keys are never exposed to AI tools.',
        action: 'deny',
        priority: 100,
        categories: [
          'sensitive-file',
          'private-key',
          'ssh-key',
          'certificate',
          'cloud-credentials',
        ],
      },
      {
        id: 'deny-high-severity',
        description: 'High-confidence, high-severity secrets are blocked.',
        action: 'deny',
        priority: 80,
        minSeverity: 'high',
      },
      {
        id: 'redact-medium-severity',
        description: 'Ambiguous, medium-severity findings are redacted, not blocked.',
        action: 'redact',
        priority: 40,
        minSeverity: 'medium',
      },
      {
        id: 'audit-low-severity',
        description: 'Low-severity findings are allowed but recorded.',
        action: 'audit-only',
        priority: 10,
        minSeverity: 'info',
      },
    ],
  };
}
