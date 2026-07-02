import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDefaultPolicy } from '@guardrails/core';
import { EXPERIENCE_LEVELS, type ExperienceLevel } from '@guardrails/shared';

export interface GuardrailsConfig {
  readonly experienceLevel: ExperienceLevel;
  readonly activePolicy: string;
  /** Tool ids `guardrails setup` has already shielded (for new-tool notices). */
  readonly shieldedTools?: readonly string[];
}

export const DEFAULT_CONFIG: GuardrailsConfig = {
  experienceLevel: 'beginner',
  activePolicy: 'default',
};

export const CONFIG_DIR = '.guardrails';
export const CONFIG_FILE = 'config.json';
export const POLICY_FILE = 'policy.json';

function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return typeof value === 'string' && (EXPERIENCE_LEVELS as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Load config from `.guardrails/config.json`, falling back to defaults. */
export async function loadConfig(
  cwd: string = process.cwd(),
): Promise<{ config: GuardrailsConfig; path: string | undefined }> {
  const path = join(cwd, CONFIG_DIR, CONFIG_FILE);
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    return {
      config: {
        experienceLevel: isExperienceLevel(parsed.experienceLevel)
          ? parsed.experienceLevel
          : DEFAULT_CONFIG.experienceLevel,
        activePolicy:
          typeof parsed.activePolicy === 'string'
            ? parsed.activePolicy
            : DEFAULT_CONFIG.activePolicy,
        ...(isStringArray(parsed.shieldedTools) ? { shieldedTools: parsed.shieldedTools } : {}),
      },
      path,
    };
  } catch {
    return { config: DEFAULT_CONFIG, path: undefined };
  }
}

/** Persist the config to `.guardrails/config.json`. */
export async function saveConfig(config: GuardrailsConfig, cwd: string = process.cwd()): Promise<string> {
  const dir = join(cwd, CONFIG_DIR);
  await mkdir(dir, { recursive: true });
  const path = join(dir, CONFIG_FILE);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  return path;
}

/** Write default config + policy files. Returns whether config already existed. */
export async function initConfig(
  cwd: string = process.cwd(),
): Promise<{ configPath: string; policyPath: string; alreadyExisted: boolean }> {
  const dir = join(cwd, CONFIG_DIR);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, CONFIG_FILE);
  const policyPath = join(dir, POLICY_FILE);
  const alreadyExisted = existsSync(configPath);
  if (!alreadyExisted) {
    await writeFile(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  }
  if (!existsSync(policyPath)) {
    await writeFile(policyPath, `${JSON.stringify(createDefaultPolicy(), null, 2)}\n`);
  }
  return { configPath, policyPath, alreadyExisted };
}
