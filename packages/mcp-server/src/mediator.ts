import {
  toFindingSummary,
  type AuditSink,
  type FileReadRequest,
  type FindingSummary,
  type MediatedResponse,
} from '@guardrails/shared';
import { Guardrails } from '@guardrails/core';
import { matchGlob } from '@guardrails/policy-engine';
import { createAuditEvent } from '@guardrails/audit';

export interface MediatorOptions {
  /** The engine that detects + decides. Defaults to a fresh `Guardrails`. */
  readonly guardrails?: Guardrails;
  /** Where to record decisions. Optional - omit to skip audit logging. */
  readonly audit?: AuditSink;
  /** Globs that are always allowed without inspection (e.g. `src/**`). */
  readonly allow?: readonly string[];
  /** Globs that are always denied outright (e.g. `**\/.env`, `**\/*.pem`). */
  readonly deny?: readonly string[];
  /** Fetch content for a path when the request omits it (e.g. read from disk). */
  readonly readContent?: (path: string) => Promise<string | undefined>;
}

function anyMatch(globs: readonly string[], path: string): boolean {
  return globs.some((glob) => matchGlob(glob, path));
}

/**
 * The heart of Phase 7: decides what an AI tool may see for a given file. It
 * consults deny/allow lists first, then runs the Guardrails engine, and records
 * a value-free audit event for every non-trivial decision. It never returns a
 * raw secret - denied content is withheld and redactable content is masked.
 */
export class Mediator {
  private readonly guardrails: Guardrails;
  private readonly audit: AuditSink | undefined;
  private readonly allow: readonly string[];
  private readonly deny: readonly string[];
  private readonly readContent: ((path: string) => Promise<string | undefined>) | undefined;

  constructor(options: MediatorOptions = {}) {
    this.guardrails = options.guardrails ?? new Guardrails();
    this.audit = options.audit;
    this.allow = options.allow ?? [];
    this.deny = options.deny ?? [];
    this.readContent = options.readContent;
  }

  private record(
    request: FileReadRequest,
    action: Parameters<typeof createAuditEvent>[0]['action'],
    reason: string,
    findings?: readonly FindingSummary[],
  ): void {
    if (this.audit === undefined) return;
    void this.audit.record(
      createAuditEvent({
        action,
        reason,
        tool: request.tool,
        path: request.path,
        ...(findings !== undefined ? { findings } : {}),
      }),
    );
  }

  async mediate(request: FileReadRequest): Promise<MediatedResponse> {
    const { path } = request;

    if (this.deny.length > 0 && anyMatch(this.deny, path)) {
      this.record(request, 'deny', 'Path is on the deny list');
      return {
        allowed: false,
        message: `Guardrails: "${path}" is on the deny list and cannot be shared with ${request.tool}.`,
      };
    }

    if (this.allow.length > 0 && anyMatch(this.allow, path)) {
      const content = await this.resolveContent(request);
      return content === undefined ? { allowed: true } : { allowed: true, content };
    }

    const content = await this.resolveContent(request);
    if (content === undefined) {
      // Nothing to inspect (path-only request we can't read). Allow, but say so.
      return { allowed: true, message: `Guardrails: "${path}" was not inspected (no content).` };
    }

    const result = this.guardrails.inspect({ path, content, tool: request.tool });
    const summaries = result.findings.map(toFindingSummary);

    switch (result.outcome) {
      case 'deny': {
        this.record(request, 'deny', 'Sensitive content withheld', summaries);
        return {
          allowed: false,
          message: `Guardrails blocked "${path}": it contains ${result.findings.length} secret(s). Access denied to ${request.tool}.`,
        };
      }
      case 'redact': {
        const { content: redacted, redactions } = this.guardrails.redact({
          path,
          content,
          tool: request.tool,
        });
        this.record(request, 'redact', 'Secrets redacted before exposure', summaries);
        return {
          allowed: true,
          content: redacted,
          message: `Guardrails redacted ${redactions} secret(s) from "${path}".`,
        };
      }
      case 'audit': {
        this.record(request, 'audit-only', 'Exposed with audit', summaries);
        return { allowed: true, content };
      }
      case 'clean':
        return { allowed: true, content };
    }
  }

  private async resolveContent(request: FileReadRequest): Promise<string | undefined> {
    if (request.content !== undefined) return request.content;
    if (this.readContent !== undefined) return this.readContent(request.path);
    return undefined;
  }
}
