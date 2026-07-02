import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Reusable "managed block" editing for plain-text config files (.cursorignore,
 * CLAUDE.md, config.toml, …). A managed block is delimited by begin/end marker
 * lines so Guardrails can update or remove exactly its own content later and
 * never disturb what the user wrote. Same pattern the git hooks use.
 */

export type ManagedStatus = 'created' | 'appended' | 'updated' | 'unchanged' | 'removed' | 'absent';

export interface ManagedMarkers {
  readonly begin: string;
  readonly end: string;
}

/** Markers for hash-comment files (.gitignore-style, TOML). */
export function hashMarkers(label = 'guardrails'): ManagedMarkers {
  return { begin: `# >>> ${label} >>>`, end: `# <<< ${label} <<<` };
}

/** Markers for Markdown/HTML files. */
export function htmlMarkers(label = 'guardrails'): ManagedMarkers {
  return { begin: `<!-- >>> ${label} >>> -->`, end: `<!-- <<< ${label} <<< -->` };
}

function renderBlock(markers: ManagedMarkers, body: readonly string[]): string {
  return [markers.begin, ...body, markers.end].join('\n');
}

function hasBlock(content: string, markers: ManagedMarkers): boolean {
  return content.includes(markers.begin) && content.includes(markers.end);
}

function replaceBlock(content: string, markers: ManagedMarkers, block: string): string {
  const start = content.indexOf(markers.begin);
  const end = content.indexOf(markers.end) + markers.end.length;
  return `${content.slice(0, start)}${block}${content.slice(end)}`;
}

/**
 * Ensure `path` contains the managed block with exactly `body` between the
 * markers. Creates the file (and parent directory) when missing, appends when
 * the file exists without a block, and rewrites the block in place otherwise.
 */
export function ensureManagedBlock(
  path: string,
  body: readonly string[],
  markers: ManagedMarkers = hashMarkers(),
): ManagedStatus {
  const block = renderBlock(markers, body);

  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${block}\n`, 'utf8');
    return 'created';
  }

  const existing = readFileSync(path, 'utf8');
  if (hasBlock(existing, markers)) {
    const updated = replaceBlock(existing, markers, block);
    if (updated === existing) return 'unchanged';
    writeFileSync(path, updated, 'utf8');
    return 'updated';
  }

  const separator = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  writeFileSync(path, `${existing}${separator}${block}\n`, 'utf8');
  return 'appended';
}

/** Remove the managed block from `path`, leaving everything else intact. */
export function removeManagedBlock(
  path: string,
  markers: ManagedMarkers = hashMarkers(),
): ManagedStatus {
  if (!existsSync(path)) return 'absent';
  const existing = readFileSync(path, 'utf8');
  if (!hasBlock(existing, markers)) return 'absent';

  const start = existing.indexOf(markers.begin);
  const end = existing.indexOf(markers.end) + markers.end.length;
  const before = existing.slice(0, start);
  let after = existing.slice(end);
  if (after.startsWith('\n')) after = after.slice(1);
  writeFileSync(path, `${before}${after}`, 'utf8');
  return 'removed';
}
