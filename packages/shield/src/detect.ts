import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Everything detection needs to know about the machine - injectable for tests. */
export interface ShieldEnv {
  readonly platform: NodeJS.Platform;
  readonly homeDir: string;
  /** `%APPDATA%` on Windows (Roaming). Unused on other platforms. */
  readonly appDataDir?: string;
}

/**
 * The real machine. `GUARDRAILS_HOME` / `GUARDRAILS_APPDATA` override the
 * detection roots - used by tests to stay hermetic and available to advanced
 * users for dry runs.
 */
export function defaultShieldEnv(): ShieldEnv {
  const appData = process.env.GUARDRAILS_APPDATA ?? process.env.APPDATA;
  return {
    platform: process.platform,
    homeDir: process.env.GUARDRAILS_HOME ?? homedir(),
    ...(appData !== undefined ? { appDataDir: appData } : {}),
  };
}

/** Where an app keeps per-user data on this platform, or undefined. */
export function appDataPath(env: ShieldEnv, appFolder: string): string | undefined {
  if (env.platform === 'win32') {
    return env.appDataDir === undefined ? undefined : join(env.appDataDir, appFolder);
  }
  if (env.platform === 'darwin') {
    return join(env.homeDir, 'Library', 'Application Support', appFolder);
  }
  return join(env.homeDir, '.config', appFolder);
}

export const SHIELDABLE_TOOL_IDS = [
  'claude-code',
  'claude-desktop',
  'cursor',
  'windsurf',
  'antigravity',
  'gemini-cli',
  'codex',
  'copilot',
] as const;

export type ShieldableToolId = (typeof SHIELDABLE_TOOL_IDS)[number];

export interface DetectedTool {
  readonly id: ShieldableToolId;
  readonly name: string;
  /** Why we think it is installed (a path that exists). */
  readonly evidence: string;
}

function firstExisting(paths: ReadonlyArray<string | undefined>): string | undefined {
  for (const path of paths) {
    if (path !== undefined && existsSync(path)) return path;
  }
  return undefined;
}

function hasVsCodeCopilot(env: ShieldEnv): string | undefined {
  const extensions = join(env.homeDir, '.vscode', 'extensions');
  if (!existsSync(extensions)) return undefined;
  try {
    const hit = readdirSync(extensions).find((name) => name.startsWith('github.copilot'));
    return hit === undefined ? undefined : join(extensions, hit);
  } catch {
    return undefined;
  }
}

/**
 * Figure out which AI coding tools live on this machine (or in this project).
 * Detection is by looking for the footprints the tools themselves create, so
 * it is instant, offline, and needs no elevated rights.
 */
export function detectTools(env: ShieldEnv, projectRoot: string): DetectedTool[] {
  const home = env.homeDir;
  const candidates: ReadonlyArray<{
    id: ShieldableToolId;
    name: string;
    paths: ReadonlyArray<string | undefined>;
  }> = [
    {
      id: 'claude-code',
      name: 'Claude Code',
      paths: [join(home, '.claude'), join(home, '.claude.json'), join(projectRoot, '.claude')],
    },
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      paths: [appDataPath(env, 'Claude')],
    },
    {
      id: 'cursor',
      name: 'Cursor',
      paths: [join(home, '.cursor'), appDataPath(env, 'Cursor'), join(projectRoot, '.cursor')],
    },
    {
      id: 'windsurf',
      name: 'Windsurf',
      paths: [join(home, '.codeium', 'windsurf')],
    },
    {
      id: 'antigravity',
      name: 'Antigravity',
      paths: [join(home, '.antigravity'), appDataPath(env, 'Antigravity')],
    },
    {
      id: 'gemini-cli',
      name: 'Gemini CLI',
      paths: [join(home, '.gemini'), join(projectRoot, '.gemini')],
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      paths: [join(home, '.codex')],
    },
  ];

  const detected: DetectedTool[] = [];
  for (const candidate of candidates) {
    const evidence = firstExisting(candidate.paths);
    if (evidence !== undefined) {
      detected.push({ id: candidate.id, name: candidate.name, evidence });
    }
  }

  const copilot = hasVsCodeCopilot(env);
  if (copilot !== undefined) {
    detected.push({ id: 'copilot', name: 'GitHub Copilot (VS Code)', evidence: copilot });
  }

  return detected;
}
