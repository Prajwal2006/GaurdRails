import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The git hooks Guardrails knows how to manage. */
export const SUPPORTED_HOOKS = ['pre-commit', 'pre-push'] as const;
export type GitHook = (typeof SUPPORTED_HOOKS)[number];

const BEGIN = '# >>> guardrails >>>';
const END = '# <<< guardrails <<<';
const SHEBANG = '#!/bin/sh';

export interface HookOptions {
  /** Which hooks to act on. Defaults to all supported hooks. */
  readonly hooks?: readonly GitHook[];
}

export type InstallStatus = 'created' | 'appended' | 'updated' | 'unchanged';
export type UninstallStatus = 'removed' | 'cleared' | 'not-managed' | 'absent';

export interface HookInstallResult {
  readonly hook: GitHook;
  readonly path: string;
  readonly status: InstallStatus;
}

export interface HookUninstallResult {
  readonly hook: GitHook;
  readonly path: string;
  readonly status: UninstallStatus;
}

export interface HookStatus {
  readonly hook: GitHook;
  readonly path: string;
  /** The hook file exists on disk. */
  readonly exists: boolean;
  /** The Guardrails managed block is present. */
  readonly managed: boolean;
}

/** The managed block that runs Guardrails, with begin/end markers. */
export function renderHookBlock(hook: GitHook): string {
  return [
    BEGIN,
    '# Managed by Guardrails. Remove with `guardrails git uninstall`.',
    'if command -v guardrails >/dev/null 2>&1; then',
    `  guardrails git ${hook} || exit $?`,
    'else',
    `  npx --no-install guardrails git ${hook} || exit $?`,
    'fi',
    END,
  ].join('\n');
}

/** A complete hook script (shebang + block) for a freshly created hook file. */
export function renderHookScript(hook: GitHook): string {
  return `${SHEBANG}\n${renderHookBlock(hook)}\n`;
}

function hasBlock(content: string): boolean {
  return content.includes(BEGIN) && content.includes(END);
}

/** Replace the managed block within existing content. Assumes a block exists. */
function replaceBlock(content: string, block: string): string {
  const start = content.indexOf(BEGIN);
  const end = content.indexOf(END) + END.length;
  return `${content.slice(0, start)}${block}${content.slice(end)}`;
}

/** Remove the managed block (and a trailing blank line) from content. */
function stripBlock(content: string): string {
  const start = content.indexOf(BEGIN);
  const end = content.indexOf(END) + END.length;
  const before = content.slice(0, start);
  let after = content.slice(end);
  if (after.startsWith('\n')) after = after.slice(1);
  return `${before}${after}`;
}

/** True when what remains is just a shebang and/or whitespace. */
function isEffectivelyEmpty(content: string): boolean {
  const meaningful = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== SHEBANG);
  return meaningful.length === 0;
}

function hookPath(hooksDir: string, hook: GitHook): string {
  return join(hooksDir, hook);
}

/** Install (or refresh) a single hook. Idempotent: re-running is a no-op. */
export function installHook(hooksDir: string, hook: GitHook): HookInstallResult {
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });
  const path = hookPath(hooksDir, hook);
  const block = renderHookBlock(hook);

  if (!existsSync(path)) {
    writeFileSync(path, renderHookScript(hook), 'utf8');
    makeExecutable(path);
    return { hook, path, status: 'created' };
  }

  const existing = readFileSync(path, 'utf8');
  if (hasBlock(existing)) {
    const updated = replaceBlock(existing, block);
    if (updated === existing) return { hook, path, status: 'unchanged' };
    writeFileSync(path, updated, 'utf8');
    return { hook, path, status: 'updated' };
  }

  // Existing hook without our block — preserve it and append ours.
  const separator = existing.endsWith('\n') ? '' : '\n';
  writeFileSync(path, `${existing}${separator}${block}\n`, 'utf8');
  makeExecutable(path);
  return { hook, path, status: 'appended' };
}

/** Remove Guardrails from a single hook, preserving any other content. */
export function uninstallHook(hooksDir: string, hook: GitHook): HookUninstallResult {
  const path = hookPath(hooksDir, hook);
  if (!existsSync(path)) return { hook, path, status: 'absent' };

  const existing = readFileSync(path, 'utf8');
  if (!hasBlock(existing)) return { hook, path, status: 'not-managed' };

  const stripped = stripBlock(existing);
  if (isEffectivelyEmpty(stripped)) {
    rmSync(path, { force: true });
    return { hook, path, status: 'removed' };
  }
  writeFileSync(path, stripped, 'utf8');
  return { hook, path, status: 'cleared' };
}

/** Report whether each hook exists and is managed by Guardrails. */
export function hookStatus(hooksDir: string, hook: GitHook): HookStatus {
  const path = hookPath(hooksDir, hook);
  if (!existsSync(path)) return { hook, path, exists: false, managed: false };
  return { hook, path, exists: true, managed: hasBlock(readFileSync(path, 'utf8')) };
}

function resolveHooks(options: HookOptions): readonly GitHook[] {
  return options.hooks ?? SUPPORTED_HOOKS;
}

export function installHooks(hooksDir: string, options: HookOptions = {}): HookInstallResult[] {
  return resolveHooks(options).map((hook) => installHook(hooksDir, hook));
}

export function uninstallHooks(hooksDir: string, options: HookOptions = {}): HookUninstallResult[] {
  return resolveHooks(options).map((hook) => uninstallHook(hooksDir, hook));
}

export function hooksStatus(hooksDir: string, options: HookOptions = {}): HookStatus[] {
  return resolveHooks(options).map((hook) => hookStatus(hooksDir, hook));
}

function makeExecutable(path: string): void {
  try {
    chmodSync(path, 0o755);
  } catch {
    // chmod is a no-op / unsupported on some platforms (e.g. Windows) — ignore.
  }
}
