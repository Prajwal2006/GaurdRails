import type { AgentId, FileReadRequest } from '@guardrails/shared';

// Field names different tools use for the file path and its content. We probe
// them in order so a single normalizer copes with several request shapes.
const PATH_FIELDS = ['path', 'file', 'filePath', 'file_path', 'uri', 'filename'] as const;
const CONTENT_FIELDS = ['content', 'text', 'data', 'body'] as const;

function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

/** Strip a `file://` scheme, if present, leaving a plain path. */
function stripFileScheme(path: string): string {
  return path.startsWith('file://') ? path.slice('file://'.length) : path;
}

/**
 * Normalize a raw, tool-specific request into a neutral `FileReadRequest`.
 * Shared by every adapter; a missing path yields an empty string so callers can
 * decide how to handle it rather than throwing during translation.
 */
export function normalizeFileRequest(
  tool: AgentId,
  raw: unknown,
  pathFields: readonly string[] = PATH_FIELDS,
  contentFields: readonly string[] = CONTENT_FIELDS,
): FileReadRequest {
  const record = asRecord(raw);
  // Some tools nest arguments under `params`, `arguments`, or `input`.
  const nested = asRecord(record.params ?? record.arguments ?? record.input);
  const path = pickString(record, pathFields) ?? pickString(nested, pathFields) ?? '';
  const content = pickString(record, contentFields) ?? pickString(nested, contentFields);
  return content === undefined
    ? { tool, path: stripFileScheme(path) }
    : { tool, path: stripFileScheme(path), content };
}
