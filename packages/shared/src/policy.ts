import type { SecretCategory } from './findings.js';
import type { Severity } from './severity.js';
import type { AgentId } from './adapter.js';

/**
 * What Guardrails decides to do with a request or a finding.
 * - `allow` / `allow-once`  — expose the content (once = not remembered).
 * - `deny` / `always-deny`  — withhold the content (always = persist the rule).
 * - `redact`                — expose with secret values masked.
 * - `audit-only`            — expose, but record the event.
 */
export const DECISION_ACTIONS = [
  'allow',
  'allow-once',
  'deny',
  'always-deny',
  'redact',
  'audit-only',
] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

/** The set of things a rule can match against. Unset fields match anything. */
export interface Scope {
  /** Project name or root path. */
  readonly project?: string;
  /** Glob relative to the project root, e.g. `config/**` or `**\/*.env`. */
  readonly path?: string;
  /** File extension without the dot, e.g. `env`, `pem`. */
  readonly extension?: string;
  /** AI tool this rule applies to. */
  readonly tool?: AgentId;
  /** User this rule applies to (enterprise). */
  readonly user?: string;
  /** Organization this rule applies to (enterprise). */
  readonly organization?: string;
}

export interface PolicyRule {
  readonly id: string;
  readonly description?: string;
  /** What this rule matches. Omit to match everything in scope. */
  readonly match?: Scope;
  readonly action: DecisionAction;
  /** Higher priority wins when multiple rules match. Default 0. */
  readonly priority?: number;
  /** Restrict this rule to specific secret categories. */
  readonly categories?: readonly SecretCategory[];
  /** Restrict this rule to findings at least this severe. */
  readonly minSeverity?: Severity;
}

export interface Policy {
  readonly id: string;
  readonly description?: string;
  /** Ids of policies this one inherits rules from (earlier = lower precedence). */
  readonly extends?: readonly string[];
  /** Action used when no rule matches. Defaults to the engine's fail-safe. */
  readonly defaultAction?: DecisionAction;
  readonly rules: readonly PolicyRule[];
}

/** A concrete decision produced by the policy engine. */
export interface Decision {
  readonly action: DecisionAction;
  readonly reason: string;
  readonly policyId?: string;
  readonly ruleId?: string;
}

/** Whether an action withholds content entirely. */
export function isBlocking(action: DecisionAction): boolean {
  return action === 'deny' || action === 'always-deny';
}

/** Whether an action exposes content (possibly transformed). */
export function isExposing(action: DecisionAction): boolean {
  return !isBlocking(action);
}

/** Whether an action should be recorded in the audit log. */
export function isAuditable(action: DecisionAction): boolean {
  // Everything except a plain one-time allow is worth recording.
  return action !== 'allow';
}
