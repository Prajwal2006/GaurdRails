import {
  meetsSeverity,
  type AgentId,
  type Decision,
  type DecisionAction,
  type Finding,
  type Policy,
  type PolicyRule,
} from '@guardrails/shared';
import { hasExtension, matchGlob } from './glob.js';

/** What a policy decision is being made about. */
export interface EvaluationContext {
  /** File path, relative to the project root, using `/` separators. */
  readonly path?: string;
  readonly project?: string;
  readonly tool?: AgentId;
  readonly user?: string;
  readonly organization?: string;
  /** The specific finding under consideration, if any. */
  readonly finding?: Finding;
}

/** True when a rule's scope and finding constraints all match the context. */
export function ruleMatches(rule: PolicyRule, ctx: EvaluationContext): boolean {
  const scope = rule.match ?? {};

  if (scope.project !== undefined && scope.project !== ctx.project) return false;
  if (scope.tool !== undefined && scope.tool !== ctx.tool) return false;
  if (scope.user !== undefined && scope.user !== ctx.user) return false;
  if (scope.organization !== undefined && scope.organization !== ctx.organization) return false;
  if (scope.path !== undefined) {
    if (ctx.path === undefined || !matchGlob(scope.path, ctx.path)) return false;
  }
  if (scope.extension !== undefined) {
    if (ctx.path === undefined || !hasExtension(ctx.path, scope.extension)) return false;
  }

  // Category / severity constraints only apply to an actual finding.
  if (rule.categories !== undefined) {
    if (ctx.finding === undefined || !rule.categories.includes(ctx.finding.category)) return false;
  }
  if (rule.minSeverity !== undefined) {
    if (ctx.finding === undefined || !meetsSeverity(ctx.finding.severity, rule.minSeverity)) {
      return false;
    }
  }
  return true;
}

/**
 * The fail-safe action used when nothing else decides. With no finding, reading
 * is allowed (it's just code). With a finding, we err toward not exposing it:
 * high+ is denied, medium is redacted, and anything lower is audited.
 */
export function failSafeAction(finding: Finding | undefined): DecisionAction {
  if (finding === undefined) return 'allow';
  if (meetsSeverity(finding.severity, 'high')) return 'deny';
  if (meetsSeverity(finding.severity, 'medium')) return 'redact';
  return 'audit-only';
}

/** Pick the winning rule: highest priority, later/own rules winning ties. */
function pickRule(rules: readonly PolicyRule[], ctx: EvaluationContext): PolicyRule | undefined {
  let best: PolicyRule | undefined;
  let bestPriority = Number.NEGATIVE_INFINITY;
  for (const rule of rules) {
    if (!ruleMatches(rule, ctx)) continue;
    const priority = rule.priority ?? 0;
    if (priority >= bestPriority) {
      best = rule;
      bestPriority = priority;
    }
  }
  return best;
}

function decisionFromRule(rule: PolicyRule, policyId: string): Decision {
  const reason = rule.description ?? `Matched rule "${rule.id}" → ${rule.action}`;
  return { action: rule.action, reason, policyId, ruleId: rule.id };
}

/**
 * Evaluate an already-resolved rule list (inherited rules first, own rules last)
 * against a context. Prefer `PolicyEngine` unless you have flattened the rules
 * yourself.
 */
export function evaluateRules(
  rules: readonly PolicyRule[],
  ctx: EvaluationContext,
  policy: Pick<Policy, 'id' | 'defaultAction'>,
): Decision {
  const winner = pickRule(rules, ctx);
  if (winner !== undefined) return decisionFromRule(winner, policy.id);
  if (policy.defaultAction !== undefined) {
    return {
      action: policy.defaultAction,
      reason: `No rule matched; policy default → ${policy.defaultAction}`,
      policyId: policy.id,
    };
  }
  const action = failSafeAction(ctx.finding);
  return { action, reason: `No rule matched; fail-safe → ${action}`, policyId: policy.id };
}

/**
 * Holds a set of policies and evaluates contexts against an active policy,
 * resolving `extends` inheritance (inherited rules have lower precedence than
 * the extending policy's own rules). Deterministic and pure.
 */
export class PolicyEngine {
  private readonly policies = new Map<string, Policy>();
  private activePolicyId: string;

  constructor(policies: readonly Policy[], activePolicyId?: string) {
    for (const policy of policies) this.policies.set(policy.id, policy);
    this.activePolicyId = activePolicyId ?? policies[0]?.id ?? '';
  }

  addPolicy(policy: Policy): this {
    this.policies.set(policy.id, policy);
    if (this.activePolicyId === '') this.activePolicyId = policy.id;
    return this;
  }

  setActivePolicy(id: string): this {
    if (!this.policies.has(id)) throw new Error(`Unknown policy: ${id}`);
    this.activePolicyId = id;
    return this;
  }

  getActivePolicyId(): string {
    return this.activePolicyId;
  }

  /** Flatten a policy's rules following `extends` (inherited first). */
  resolveRules(policyId: string, seen: Set<string> = new Set()): PolicyRule[] {
    const policy = this.policies.get(policyId);
    if (policy === undefined || seen.has(policyId)) return [];
    seen.add(policyId);
    const inherited: PolicyRule[] = [];
    for (const parentId of policy.extends ?? []) {
      inherited.push(...this.resolveRules(parentId, seen));
    }
    return [...inherited, ...policy.rules];
  }

  /** Evaluate a context against a policy (defaults to the active policy). */
  evaluate(ctx: EvaluationContext, policyId: string = this.activePolicyId): Decision {
    const policy = this.policies.get(policyId);
    if (policy === undefined) {
      const action = failSafeAction(ctx.finding);
      return { action, reason: `Unknown policy "${policyId}"; fail-safe → ${action}` };
    }
    return evaluateRules(this.resolveRules(policyId), ctx, policy);
  }

  /** Evaluate each finding in turn, returning a decision per finding. */
  evaluateFindings(
    findings: readonly Finding[],
    baseCtx: Omit<EvaluationContext, 'finding'> = {},
    policyId: string = this.activePolicyId,
  ): Array<{ finding: Finding; decision: Decision }> {
    return findings.map((finding) => ({
      finding,
      decision: this.evaluate({ ...baseCtx, finding }, policyId),
    }));
  }
}
