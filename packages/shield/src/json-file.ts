import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Careful JSON config editing. Guardrails merges into files owned by other
 * apps (Claude Desktop, Cursor, VS Code, …), so the rules are strict:
 * - never touch a file we cannot parse (report it instead),
 * - keep every existing key,
 * - write a one-time `.guardrails-backup` next to a file before first change.
 */

export type JsonStatus = 'created' | 'updated' | 'unchanged' | 'unparseable';

export interface JsonEditResult {
  readonly status: JsonStatus;
  readonly path: string;
}

export type JsonObject = Record<string, unknown>;

/**
 * Read `path` (or `{}` when missing), let `mutate` change the object, and
 * write it back pretty-printed. Returns `unparseable` - without writing -
 * when the existing file is not valid JSON (e.g. JSONC with comments).
 */
export function mergeJsonFile(path: string, mutate: (config: JsonObject) => void): JsonEditResult {
  let config: JsonObject = {};
  let original: string | undefined;

  if (existsSync(path)) {
    original = readFileSync(path, 'utf8');
    if (original.trim().length > 0) {
      try {
        const parsed: unknown = JSON.parse(original);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { status: 'unparseable', path };
        }
        config = parsed as JsonObject;
      } catch {
        return { status: 'unparseable', path };
      }
    }
  }

  mutate(config);
  const next = `${JSON.stringify(config, null, 2)}\n`;

  if (original !== undefined && next === original) return { status: 'unchanged', path };

  if (original !== undefined) {
    const backup = `${path}.guardrails-backup`;
    if (!existsSync(backup)) writeFileSync(backup, original, 'utf8');
  } else {
    mkdirSync(dirname(path), { recursive: true });
  }
  writeFileSync(path, next, 'utf8');
  return { status: original === undefined ? 'created' : 'updated', path };
}

/** `config[key]` as an object, creating it when missing or wrongly typed. */
export function objectAt(config: JsonObject, key: string): JsonObject {
  const existing = config[key];
  if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
    return existing as JsonObject;
  }
  const fresh: JsonObject = {};
  config[key] = fresh;
  return fresh;
}

/** Append `values` to the string array at `config[key]`, deduplicated. */
export function addToStringArray(
  config: JsonObject,
  key: string,
  values: readonly string[],
): void {
  const existing = config[key];
  const array: unknown[] = Array.isArray(existing) ? existing : [];
  for (const value of values) {
    if (!array.includes(value)) array.push(value);
  }
  config[key] = array;
}
