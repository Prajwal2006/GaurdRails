import { randomUUID } from 'node:crypto';
import type { AgentId, AuditEvent, DecisionAction, FindingSummary } from '@guardrails/shared';

/** The fields a caller supplies; id and timestamp are filled in for them. */
export interface AuditEventInput {
  readonly action: DecisionAction;
  readonly reason: string;
  readonly tool?: AgentId;
  readonly path?: string;
  readonly policyId?: string;
  readonly ruleId?: string;
  readonly findings?: readonly FindingSummary[];
}

/** Injectable clock/id generators so events are deterministic under test. */
export interface AuditEventDeps {
  readonly now?: () => Date;
  readonly id?: () => string;
}

/**
 * Build a complete `AuditEvent` from the caller's intent, stamping it with an
 * id and ISO timestamp. Optional fields are only included when defined, to
 * satisfy `exactOptionalPropertyTypes`. This never carries a raw secret value -
 * only value-free finding summaries.
 */
export function createAuditEvent(input: AuditEventInput, deps: AuditEventDeps = {}): AuditEvent {
  const now = deps.now ?? (() => new Date());
  const id = deps.id ?? randomUUID;
  return {
    id: id(),
    timestamp: now().toISOString(),
    action: input.action,
    reason: input.reason,
    ...(input.tool !== undefined ? { tool: input.tool } : {}),
    ...(input.path !== undefined ? { path: input.path } : {}),
    ...(input.policyId !== undefined ? { policyId: input.policyId } : {}),
    ...(input.ruleId !== undefined ? { ruleId: input.ruleId } : {}),
    ...(input.findings !== undefined ? { findings: input.findings } : {}),
  };
}
