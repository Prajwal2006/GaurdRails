import type { AgentAdapter, AgentId, FileReadRequest, MediatedResponse } from '@guardrails/shared';

/**
 * Configuration for a tool adapter. Adding support for a new AI tool is usually
 * a single call to `createAgentAdapter` — the shared engine does the real work.
 */
export interface AdapterConfig {
  readonly id: AgentId;
  readonly displayName: string;
  /** Keys to look for a file path under. Defaults cover the common shapes. */
  readonly pathKeys?: readonly string[];
  /** Keys to look for file content under. */
  readonly contentKeys?: readonly string[];
}

const DEFAULT_PATH_KEYS = ['path', 'file', 'filePath', 'filename', 'uri', 'url'] as const;
const DEFAULT_CONTENT_KEYS = ['content', 'text', 'data', 'body'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

/** Strip a `file://` prefix so paths are plain filesystem paths. */
function toPlainPath(path: string): string {
  return path.startsWith('file://') ? decodeURIComponent(path.replace(/^file:\/\//, '')) : path;
}

/**
 * Build an `AgentAdapter` from a small config. The adapter normalises a tool's
 * raw request into Guardrails' neutral `FileReadRequest` and formats a
 * `MediatedResponse` back into a simple, tool-agnostic object.
 */
export function createAgentAdapter(config: AdapterConfig): AgentAdapter {
  const pathKeys = config.pathKeys ?? DEFAULT_PATH_KEYS;
  const contentKeys = config.contentKeys ?? DEFAULT_CONTENT_KEYS;

  return {
    id: config.id,
    displayName: config.displayName,

    normalizeRequest(raw: unknown): FileReadRequest {
      if (!isRecord(raw)) {
        throw new Error(`${config.displayName}: request must be an object`);
      }
      const rawPath = firstString(raw, pathKeys);
      if (rawPath === undefined) {
        throw new Error(`${config.displayName}: could not find a file path in the request`);
      }
      const path = toPlainPath(rawPath);
      const content = firstString(raw, contentKeys);
      return content === undefined ? { tool: config.id, path } : { tool: config.id, path, content };
    },

    formatResponse(response: MediatedResponse): unknown {
      const out: Record<string, unknown> = { tool: config.id, allowed: response.allowed };
      if (response.content !== undefined) out.content = response.content;
      if (response.message !== undefined) out.message = response.message;
      return out;
    },
  };
}
