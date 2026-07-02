import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const HOOK_MARKER = '# guardrails-managed-hook';
export const MANAGED_HOOKS = ['pre-commit', 'pre-push'] as const;
export type ManagedHook = (typeof MANAGED_HOOKS)[number];

const HOOK_COMMANDS: Record<ManagedHook, string> = {
  'pre-commit': 'guardrails git verify --staged',
  'pre-push': 'guardrails git verify',
};

function hookScript(hook: ManagedHook): string {
  return [
    '#!/bin/sh',
    HOOK_MARKER,
    '# Installed by `guardrails git install`. Remove with `guardrails git uninstall`.',
    '# Override a single run with the standard git flag: --no-verify',
    `exec ${HOOK_COMMANDS[hook]}`,
    '',
  ].join('\n');
}

export type InstallStatus = 'created' | 'updated' | 'skipped-foreign' | 'backed-up';

export interface HookResult {
  readonly hook: ManagedHook;
  readonly status: InstallStatus;
  readonly path: string;
}

function isManaged(content: string): boolean {
  return content.includes(HOOK_MARKER);
}

/**
 * Install the Guardrails hooks into a hooks directory. Idempotent: re-installing
 * updates our own hooks. A pre-existing foreign hook is left untouched unless
 * `force` is set, in which case it is backed up first.
 */
export async function installHooks(
  hooksDir: string,
  options: { force?: boolean } = {},
): Promise<HookResult[]> {
  await mkdir(hooksDir, { recursive: true });
  const results: HookResult[] = [];

  for (const hook of MANAGED_HOOKS) {
    const path = join(hooksDir, hook);
    let status: InstallStatus;

    if (existsSync(path)) {
      const existing = await readFile(path, 'utf8');
      if (isManaged(existing)) {
        status = 'updated';
      } else if (options.force) {
        await rename(path, `${path}.pre-guardrails`);
        status = 'backed-up';
      } else {
        results.push({ hook, status: 'skipped-foreign', path });
        continue;
      }
    } else {
      status = 'created';
    }

    await writeFile(path, hookScript(hook));
    await chmod(path, 0o755);
    results.push({ hook, status, path });
  }

  return results;
}

export type UninstallStatus = 'removed' | 'restored' | 'absent' | 'skipped-foreign';

export interface UninstallResult {
  readonly hook: ManagedHook;
  readonly status: UninstallStatus;
  readonly path: string;
}

/** Remove the Guardrails hooks, restoring any backed-up foreign hook. */
export async function uninstallHooks(hooksDir: string): Promise<UninstallResult[]> {
  const results: UninstallResult[] = [];

  for (const hook of MANAGED_HOOKS) {
    const path = join(hooksDir, hook);
    if (!existsSync(path)) {
      results.push({ hook, status: 'absent', path });
      continue;
    }
    const content = await readFile(path, 'utf8');
    if (!isManaged(content)) {
      results.push({ hook, status: 'skipped-foreign', path });
      continue;
    }

    const backup = `${path}.pre-guardrails`;
    if (existsSync(backup)) {
      await rename(backup, path);
      results.push({ hook, status: 'restored', path });
    } else {
      const { rm } = await import('node:fs/promises');
      await rm(path);
      results.push({ hook, status: 'removed', path });
    }
  }

  return results;
}
