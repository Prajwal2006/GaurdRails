import type { DetectionInput } from './detector.js';

/**
 * Identifier for an AI coding tool. Known tools are enumerated for ergonomics,
 * but any string is accepted so third-party adapters can register new tools
 * without a core change.
 */
export type KnownAgentId =
  'claude-code' | 'codex' | 'copilot' | 'gemini-cli' | 'cursor' | 'windsurf';

// The `string & {}` trick keeps editor autocomplete for known ids while still
// allowing arbitrary strings.
export type AgentId = KnownAgentId | (string & {});

export const KNOWN_AGENTS: readonly KnownAgentId[] = [
  'claude-code',
  'codex',
  'copilot',
  'gemini-cli',
  'cursor',
  'windsurf',
];

/** A normalised request from an AI tool to read a file. */
export interface FileReadRequest {
  readonly tool: AgentId;
  readonly path: string;
  /** File content, when the tool provides it (some tools only send a path). */
  readonly content?: string;
}

/** The result of a mediated request, in Guardrails' neutral form. */
export interface MediatedResponse {
  readonly allowed: boolean;
  /** Content to return to the tool - possibly redacted, possibly withheld. */
  readonly content?: string;
  /** A human-readable, educational message when access is limited. */
  readonly message?: string;
}

/**
 * Adapts a specific AI tool to Guardrails' neutral request/response shape. Keep
 * adapters thin - all security logic lives in the shared engine; an adapter only
 * translates formats.
 */
export interface AgentAdapter {
  readonly id: AgentId;
  readonly displayName: string;
  /** Turn a raw, tool-specific request into a neutral `FileReadRequest`. */
  normalizeRequest(raw: unknown): FileReadRequest;
  /** Turn a neutral response back into whatever the tool expects. */
  formatResponse(response: MediatedResponse): unknown;
}

/** Convenience: a `FileReadRequest` viewed as detection input. */
export function toDetectionInput(request: FileReadRequest): DetectionInput {
  return request.content === undefined
    ? { path: request.path, content: '' }
    : { path: request.path, content: request.content };
}
