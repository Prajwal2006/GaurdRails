import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { Guardrails, matchGlob, redactContent } from '@guardrails/core';
import {
  toFindingSummary,
  type AuditEvent,
  type AuditSink,
  type FindingSummary,
} from '@guardrails/shared';

export const DENY_MESSAGE =
  'Access denied. This file appears to contain sensitive information. Ask the user for permission if you genuinely need it.';

export type ReadStatus = 'allowed' | 'redacted' | 'denied' | 'error';

export interface ReadResult {
  readonly status: ReadStatus;
  readonly path: string;
  readonly content?: string;
  readonly message?: string;
  readonly findings?: readonly FindingSummary[];
}

export interface GuardedFileServerOptions {
  /** Root directory the server is allowed to serve from. */
  readonly root: string;
  readonly guardrails?: Guardrails;
  /** If set, only paths matching one of these globs may be read. */
  readonly allow?: readonly string[];
  /** Paths matching any of these globs are always denied. */
  readonly deny?: readonly string[];
  /** Optional audit sink; every non-trivial decision is recorded (never a value). */
  readonly audit?: AuditSink;
}

let counter = 0;
function eventId(): string {
  counter += 1;
  return `mcp-${Date.now().toString(36)}-${counter}`;
}

/**
 * Mediates file reads for an AI tool: only approved files are returned, secrets
 * are redacted, and sensitive files are denied with a clear, non-technical
 * message. This is the enforcement point of the MCP integration.
 */
export class GuardedFileServer {
  private readonly root: string;
  private readonly guardrails: Guardrails;
  private readonly allow: readonly string[] | undefined;
  private readonly deny: readonly string[];
  private readonly audit: AuditSink | undefined;

  constructor(options: GuardedFileServerOptions) {
    this.root = resolve(options.root);
    this.guardrails = options.guardrails ?? new Guardrails();
    this.allow = options.allow;
    this.deny = options.deny ?? [];
    this.audit = options.audit;
  }

  /** True when `relPath` resolves to a location inside the served root. */
  private within(relPath: string): boolean {
    const abs = resolve(this.root, relPath);
    return abs === this.root || abs.startsWith(this.root + sep);
  }

  private denied(
    relPath: string,
    reason: string,
    findings?: readonly FindingSummary[],
  ): ReadResult {
    this.record(relPath, 'deny', reason, findings);
    return {
      status: 'denied',
      path: relPath,
      message: DENY_MESSAGE,
      ...(findings ? { findings } : {}),
    };
  }

  private record(
    path: string,
    action: AuditEvent['action'],
    reason: string,
    findings?: readonly FindingSummary[],
  ): void {
    if (this.audit === undefined) return;
    const event: AuditEvent = {
      id: eventId(),
      timestamp: new Date().toISOString(),
      tool: 'mcp',
      path,
      action,
      reason,
      ...(findings ? { findings } : {}),
    };
    void this.audit.record(event);
  }

  /** Read a file through the guard. Never returns a raw secret. */
  async read(relPath: string): Promise<ReadResult> {
    const normalized = relPath.replace(/\\/g, '/');

    if (!this.within(relPath)) {
      return this.denied(normalized, 'path escapes served root');
    }
    if (this.deny.some((glob) => matchGlob(glob, normalized))) {
      return this.denied(normalized, 'matched deny list');
    }
    if (this.allow !== undefined && !this.allow.some((glob) => matchGlob(glob, normalized))) {
      return this.denied(normalized, 'not on allow list');
    }

    let content: string;
    try {
      content = await readFile(resolve(this.root, relPath), 'utf8');
    } catch (error) {
      return {
        status: 'error',
        path: normalized,
        message: `Could not read file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const result = this.guardrails.inspect({ path: normalized, content });
    const summaries = result.findings.map(toFindingSummary);

    if (result.outcome === 'deny') {
      return this.denied(normalized, 'contains sensitive information', summaries);
    }
    if (result.outcome === 'redact') {
      const toRedact = result.decided
        .filter((d) => d.decision.action === 'redact' || d.decision.action === 'deny')
        .map((d) => d.finding);
      const { content: redacted } = redactContent(content, toRedact);
      this.record(normalized, 'redact', 'redacted sensitive values', summaries);
      return { status: 'redacted', path: normalized, content: redacted, findings: summaries };
    }

    if (result.outcome === 'audit') {
      this.record(normalized, 'audit-only', 'served with audit', summaries);
    }
    return { status: 'allowed', path: normalized, content };
  }

  /** A path relative to the served root, for display. */
  relative(abs: string): string {
    return relative(this.root, abs).replace(/\\/g, '/');
  }
}

/** A simple in-memory audit sink (most-recent-first). */
export class MemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];

  record(event: AuditEvent): void {
    this.events.unshift(event);
  }

  list(limit?: number): AuditEvent[] {
    return limit === undefined ? [...this.events] : this.events.slice(0, limit);
  }
}
