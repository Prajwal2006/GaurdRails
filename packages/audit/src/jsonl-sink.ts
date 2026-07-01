import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuditEvent, AuditSink } from '@guardrails/shared';

/**
 * A file-backed audit sink using JSON Lines (one JSON object per line). Appends
 * are atomic per write and the file is human-readable. Because audit events are
 * value-free by construction, this file is safe to keep and share.
 */
export class JsonlAuditSink implements AuditSink {
  constructor(private readonly filePath: string) {}

  /** The path this sink writes to. */
  get path(): string {
    return this.filePath;
  }

  record(event: AuditEvent): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, 'utf8');
  }

  list(limit?: number): AuditEvent[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const events: AuditEvent[] = [];
    for (const line of lines) {
      try {
        events.push(JSON.parse(line) as AuditEvent);
      } catch {
        // A corrupt line should never crash the reader — skip it.
      }
    }
    events.reverse(); // most recent first
    return limit === undefined ? events : events.slice(0, Math.max(0, limit));
  }
}
