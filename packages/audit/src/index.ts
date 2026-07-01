/**
 * @guardrails/audit — persistence for value-free audit events. Provides an
 * in-memory sink for tests and a JSONL file sink for real use. The sink
 * interface itself lives in `@guardrails/shared`.
 */

export { createAuditEvent, type AuditEventInput, type AuditEventDeps } from './event.js';
export { MemoryAuditSink } from './memory-sink.js';
export { JsonlAuditSink } from './jsonl-sink.js';
