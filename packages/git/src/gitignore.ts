import { appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Append patterns to a repository's `.gitignore` (creating the section if
 * needed), skipping any already present. Returns the patterns actually added.
 */
export async function addToGitignore(
  repoRoot: string,
  patterns: readonly string[],
): Promise<string[]> {
  const path = join(repoRoot, '.gitignore');
  const existing = existsSync(path) ? await readFile(path, 'utf8') : '';
  const present = new Set(existing.split('\n').map((line) => line.trim()));

  const toAdd = patterns.filter((p) => p.length > 0 && !present.has(p));
  if (toAdd.length === 0) return [];

  const needsNewline = existing.length > 0 && !existing.endsWith('\n');
  await appendFile(
    path,
    `${needsNewline ? '\n' : ''}\n# Added by Guardrails\n${toAdd.join('\n')}\n`,
  );
  return toAdd;
}
