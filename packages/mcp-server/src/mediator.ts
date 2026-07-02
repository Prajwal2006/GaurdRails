import {
  toFindingSummary,
  type AuditSink,
  type FileReadRequest,
  type FindingSummary,
  type MediatedResponse,
} from '@guardrails/shared';
import { Guardrails } from '@guardrails/core';
import { matchGlob } from '@guardrails/policy-engine';
import { redactContent, redactEnvContent } from '@guardrails/redaction';
import { createAuditEvent } from '@guardrails/audit';

/**
 * What to do when policy says "deny":
 * - `redact` (default): the AI receives a copy with every secret value replaced
 *   by `<REDACTED>` - it can still see the file's structure and help, but no
 *   real value ever leaves the machine.
 * - `withhold`: the AI receives nothing but an explanation.
 */
export type DenyMode = 'redact' | 'withhold';

export interface MediatorOptions {
  /** The engine that detects + decides. Defaults to a fresh `Guardrails`. */
  readonly guardrails?: Guardrails;
  /** Where to record decisions. Optional - omit to skip audit logging. */
  readonly audit?: AuditSink;
  /** Globs that are always allowed without inspection (e.g. `src/**`). */
  readonly allow?: readonly string[];
  /** Globs that are always denied outright (e.g. `**\/.env`, `**\/*.pem`). */
  readonly deny?: readonly string[];
  /** How to answer when policy denies a file. Default `redact`. */
  readonly denyMode?: DenyMode;
  /** Fetch content for a path when the request omits it (e.g. read from disk). */
  readonly readContent?: (path: string) => Promise<string | undefined>;
}

function anyMatch(globs: readonly string[], path: string): boolean {
  return globs.some((glob) => matchGlob(glob, path));
}

/**
 * The plain-language note an AI tool (and the person driving it) sees when a
 * sensitive file is served as a redacted copy. Written for beginners: what
 * happened, why it matters, and that nothing secret left the machine.
 */
function redactedCopyMessage(path: string, tool: string): string {
  return (
    `🛡️ Guardrails protected "${path}". This file holds secrets - things like passwords and API keys. ` +
    `Anything an AI reads is sent to ${tool}'s servers, so Guardrails sent a safe copy instead: ` +
    `every secret value is replaced with <REDACTED>. Your real values never left your computer. ` +
    `(AI: do not try to read the original values; work with the placeholders.)`
  );
}

function withheldMessage(path: string, tool: string): string {
  return (
    `🛡️ Guardrails blocked "${path}". This file holds secrets - things like passwords and API keys. ` +
    `If ${tool} read it, those secrets would be sent to its servers. ` +
    `Nothing was shared. Keep secrets in this file and give the AI a safe example file instead (e.g. ".env.example").`
  );
}

/**
 * Decides what an AI tool may see for a given file. It consults deny/allow
 * globs first, then runs the Guardrails engine, and records a value-free audit
 * event for every non-trivial decision. It never returns a raw secret:
 * denied content is either withheld or served as a fully redacted copy
 * (per `denyMode`), and redactable content is masked.
 */
export class Mediator {
  private readonly guardrails: Guardrails;
  private readonly audit: AuditSink | undefined;
  private readonly allow: readonly string[];
  private readonly deny: readonly string[];
  private readonly denyMode: DenyMode;
  private readonly readContent: ((path: string) => Promise<string | undefined>) | undefined;

  constructor(options: MediatorOptions = {}) {
    this.guardrails = options.guardrails ?? new Guardrails();
    this.audit = options.audit;
    this.allow = options.allow ?? [];
    this.deny = options.deny ?? [];
    this.denyMode = options.denyMode ?? 'redact';
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

    // An explicit deny glob is a hard "no" from the user - always withhold.
    if (this.deny.length > 0 && anyMatch(this.deny, path)) {
      this.record(request, 'deny', 'Path is on the deny list');
      return { allowed: false, message: withheldMessage(path, request.tool) };
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
        if (this.denyMode === 'withhold') {
          this.record(request, 'deny', 'Sensitive content withheld', summaries);
          return { allowed: false, message: withheldMessage(path, request.tool) };
        }
        // Default: serve a fully redacted copy so the AI can still help,
        // while every secret value stays on this machine.
        this.record(
          request,
          'redact',
          'Denied by policy - served a fully redacted copy instead',
          summaries,
        );
        return {
          allowed: true,
          content: this.fullyRedact(path, content, result),
          message: redactedCopyMessage(path, request.tool),
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
          message: `🛡️ Guardrails hid ${redactions} secret value(s) in "${path}" before sharing it. The AI sees <REDACTED> placeholders, not your real values.`,
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

  /**
   * Produce the redacted copy for a denied file. Every detected secret span is
   * masked. When the file was flagged as sensitive by its name (e.g. `.env`),
   * every `KEY=value` value is masked first - belt and braces, so values the
   * detectors did not recognise still never leave the machine - and the masked
   * copy is re-scanned to catch anything span-based (e.g. an inline PEM block).
   */
  private fullyRedact(
    path: string,
    content: string,
    result: ReturnType<Guardrails['inspect']>,
  ): string {
    const flaggedByName = result.findings.some((f) => f.index === undefined);
    if (!flaggedByName) {
      // Mask every finding, not just the blocking ones - the file is denied.
      return redactContent(content, result.findings).content;
    }
    const envMasked = redactEnvContent(content).content;
    const rescan = this.guardrails.inspect({ path, content: envMasked });
    return redactContent(envMasked, rescan.findings).content;
  }

  private async resolveContent(request: FileReadRequest): Promise<string | undefined> {
    if (request.content !== undefined) return request.content;
    if (this.readContent !== undefined) return this.readContent(request.path);
    return undefined;
  }
}
