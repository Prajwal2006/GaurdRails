import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GitScanResult } from './scanner.js';

export interface AutoFixSuggestion {
  readonly title: string;
  readonly detail: string;
  /** A shell command that applies the fix, when one exists. */
  readonly command?: string;
}

// File basenames / patterns that should virtually never be committed.
const SECRET_FILE_PATTERNS: ReadonlyArray<{ readonly test: RegExp; readonly pattern: string }> = [
  { test: /(^|\/)\.env(\.[\w-]+)?$/i, pattern: '.env' },
  { test: /\.pem$/i, pattern: '*.pem' },
  { test: /\.key$/i, pattern: '*.key' },
  { test: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i, pattern: 'id_*' },
  { test: /\.p12$/i, pattern: '*.p12' },
  { test: /\.pfx$/i, pattern: '*.pfx' },
  { test: /(^|\/)\.npmrc$/i, pattern: '.npmrc' },
  { test: /(^|\/)credentials$/i, pattern: 'credentials' },
];

/** Derive a de-duplicated set of `.gitignore` patterns for the offending files. */
export function gitignorePatternsFor(paths: readonly string[]): string[] {
  const patterns = new Set<string>();
  for (const path of paths) {
    for (const { test, pattern } of SECRET_FILE_PATTERNS) {
      if (test.test(path)) patterns.add(pattern);
    }
  }
  return [...patterns];
}

/** True when a path looks like a dotenv file. */
export function isEnvFile(path: string): boolean {
  return /(^|\/)\.env(\.[\w-]+)?$/i.test(path);
}

/**
 * Turn `.env` content into a safe `.env.example`: keys are kept, values are
 * stripped. Comments and blank lines are preserved. Never emits a real value.
 */
export function buildEnvExample(envContent: string): string {
  return envContent
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.length === 0 || trimmed.startsWith('#')) return line;
      const eq = line.indexOf('=');
      if (eq === -1) return line;
      return line.slice(0, eq + 1);
    })
    .join('\n');
}

/** Build human-facing suggestions for a scan result. Pure — no I/O. */
export function suggestFixes(result: GitScanResult): AutoFixSuggestion[] {
  const suggestions: AutoFixSuggestion[] = [];
  const paths = result.files.map((f) => f.path);

  const ignorePatterns = gitignorePatternsFor(paths);
  if (ignorePatterns.length > 0) {
    suggestions.push({
      title: 'Stop tracking secret files',
      detail: `Add to .gitignore: ${ignorePatterns.join(', ')}`,
      command: `guardrails git fix`,
    });
  }

  const envFiles = paths.filter(isEnvFile);
  if (envFiles.length > 0) {
    suggestions.push({
      title: 'Share config safely',
      detail: `Create a value-free .env.example from ${envFiles.join(', ')} so teammates know which keys are needed.`,
      command: `guardrails git fix`,
    });
  }

  suggestions.push({
    title: 'Rotate exposed credentials',
    detail:
      'Any secret that reached git history should be considered compromised. Rotate it at the provider, even after removing it here.',
  });

  return suggestions;
}

export interface AppliedFix {
  readonly kind: 'gitignore' | 'env-example';
  readonly path: string;
  readonly detail: string;
}

/** Append patterns to `.gitignore` without duplicating existing entries. */
export function ensureGitignore(root: string, patterns: readonly string[]): AppliedFix | undefined {
  if (patterns.length === 0) return undefined;
  const path = join(root, '.gitignore');
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const present = new Set(existing.split('\n').map((line) => line.trim()));
  const missing = patterns.filter((pattern) => !present.has(pattern));
  if (missing.length === 0) return undefined;

  const header = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  const block = `${header}\n# Added by Guardrails\n${missing.join('\n')}\n`;
  writeFileSync(path, `${existing}${block}`, 'utf8');
  return { kind: 'gitignore', path, detail: `added ${missing.join(', ')}` };
}

/** Write a `.env.example` next to an `.env` file, if one doesn't already exist. */
export function writeEnvExample(root: string, envRelPath: string): AppliedFix | undefined {
  const source = join(root, envRelPath);
  if (!existsSync(source)) return undefined;
  const examplePath = `${source}.example`;
  if (existsSync(examplePath)) return undefined;
  const example = buildEnvExample(readFileSync(source, 'utf8'));
  writeFileSync(examplePath, example, 'utf8');
  return { kind: 'env-example', path: examplePath, detail: 'created from keys only' };
}

/** Apply the safe, reversible fixes for a scan result. */
export function applyFixes(root: string, result: GitScanResult): AppliedFix[] {
  const applied: AppliedFix[] = [];
  const paths = result.files.map((f) => f.path);

  const gitignore = ensureGitignore(root, gitignorePatternsFor(paths));
  if (gitignore !== undefined) applied.push(gitignore);

  for (const envFile of paths.filter(isEnvFile)) {
    const env = writeEnvExample(root, envFile);
    if (env !== undefined) applied.push(env);
  }
  return applied;
}
