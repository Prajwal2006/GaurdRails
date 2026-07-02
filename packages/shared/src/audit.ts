import type { DecisionAction } from './policy.js';
import type { FindingSummary } from './findings.js';
import type { AgentId } from './adapter.js';

/**
 * A single audit-log entry. Audit events are persisted, so they must never
 * contain a raw secret value - only summaries (category/severity/location).
 */
export interface AuditEvent {
  /** Unique id for the event. */
  readonly id: string;
  /** ISO-8601 timestamp. */
  readonly timestamp: string;
  /** The AI tool involved, when applicable. */
  readonly tool?: AgentId;
  /** The file the request concerned. */
  readonly path?: string;
  /** The decision that was taken. */
  readonly action: DecisionAction;
  /** The policy and rule responsible, for traceability. */
  readonly policyId?: string;
  readonly ruleId?: string;
  /** Human-readable reason. */
  readonly reason: string;
  /** Value-free summaries of what was found. */
  readonly findings?: readonly FindingSummary[];
}

/** A sink that persists audit events. Implementations decide where (file, db…). */
export interface AuditSink {
  record(event: AuditEvent): void | Promise<void>;
  /** Read events back, most recent first, optionally limited. */
  list(limit?: number): AuditEvent[] | Promise<AuditEvent[]>;
}
