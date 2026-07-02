import type { AuditEvent, AuditSink } from '@guardrails/shared';

/**
 * An in-memory audit sink. Handy for tests and short-lived processes. Events
 * are returned most-recent-first, matching the `AuditSink` contract.
 */
export class MemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];

  record(event: AuditEvent): void {
    this.events.push(event);
  }

  list(limit?: number): AuditEvent[] {
    const reversed = [...this.events].reverse();
    return limit === undefined ? reversed : reversed.slice(0, Math.max(0, limit));
  }

  /** Number of events recorded so far. */
  get size(): number {
    return this.events.length;
  }

  /** Forget all recorded events. */
  clear(): void {
    this.events.length = 0;
  }
}
