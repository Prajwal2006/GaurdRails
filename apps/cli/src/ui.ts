import type { DecisionAction, Severity } from '@guardrails/shared';

// Color is enabled unless NO_COLOR is set or output is not a TTY. FORCE_COLOR
// overrides. Evaluated per call so tests can toggle it via env.
function colorEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR === '1' || process.env.FORCE_COLOR === 'true') return true;
  return process.stdout.isTTY === true;
}

function wrap(code: string, text: string): string {
  return colorEnabled() ? `[${code}m${text}[0m` : text;
}

export const c = {
  red: (s: string) => wrap('31', s),
  green: (s: string) => wrap('32', s),
  yellow: (s: string) => wrap('33', s),
  blue: (s: string) => wrap('34', s),
  magenta: (s: string) => wrap('35', s),
  cyan: (s: string) => wrap('36', s),
  gray: (s: string) => wrap('90', s),
  bold: (s: string) => wrap('1', s),
  dim: (s: string) => wrap('2', s),
};

export const icon = {
  shield: '🛡️',
  check: '✓',
  cross: '✗',
  warn: '⚠',
  info: 'ℹ',
  lock: '🔒',
  bullet: '•',
  arrow: '→',
};

const SEVERITY_STYLE: Record<Severity, (s: string) => string> = {
  critical: (s) => c.bold(c.red(s)),
  high: (s) => c.red(s),
  medium: (s) => c.yellow(s),
  low: (s) => c.cyan(s),
  info: (s) => c.gray(s),
};

/** A colored, fixed-width severity badge like `[CRITICAL]`. */
export function severityBadge(severity: Severity): string {
  const label = severity.toUpperCase().padEnd(8);
  return SEVERITY_STYLE[severity](`[${label}]`);
}

const ACTION_STYLE: Record<DecisionAction, (s: string) => string> = {
  deny: (s) => c.red(s),
  'always-deny': (s) => c.red(s),
  redact: (s) => c.yellow(s),
  'audit-only': (s) => c.cyan(s),
  allow: (s) => c.green(s),
  'allow-once': (s) => c.green(s),
};

/** A colored label describing the policy decision, e.g. `blocked`. */
export function actionLabel(action: DecisionAction): string {
  const word =
    action === 'deny' || action === 'always-deny'
      ? 'blocked'
      : action === 'redact'
        ? 'redacted'
        : action === 'audit-only'
          ? 'audited'
          : 'allowed';
  return ACTION_STYLE[action](word);
}

/** A section heading. */
export function heading(text: string): string {
  return c.bold(`${icon.shield} ${text}`);
}
