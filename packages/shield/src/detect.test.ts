import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appDataPath, detectTools, type ShieldEnv } from './detect.js';

let home: string;
let project: string;
let appData: string;

function env(platform: NodeJS.Platform = 'win32'): ShieldEnv {
  return { platform, homeDir: home, appDataDir: appData };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'guardrails-home-'));
  project = mkdtempSync(join(tmpdir(), 'guardrails-proj-'));
  appData = join(home, 'AppData', 'Roaming');
  mkdirSync(appData, { recursive: true });
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

describe('detectTools', () => {
  it('finds nothing on a bare machine', () => {
    expect(detectTools(env(), project)).toEqual([]);
  });

  it('detects tools by their home-directory footprints', () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    mkdirSync(join(home, '.gemini'), { recursive: true });
    mkdirSync(join(home, '.codex'), { recursive: true });
    mkdirSync(join(home, '.codeium', 'windsurf'), { recursive: true });
    mkdirSync(join(appData, 'Claude'), { recursive: true });

    const ids = detectTools(env(), project).map((t) => t.id);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('claude-desktop');
    expect(ids).toContain('gemini-cli');
    expect(ids).toContain('codex');
    expect(ids).toContain('windsurf');
    expect(ids).not.toContain('cursor');
  });

  it('detects a tool from its project footprint alone', () => {
    mkdirSync(join(project, '.cursor'), { recursive: true });
    const ids = detectTools(env(), project).map((t) => t.id);
    expect(ids).toContain('cursor');
  });

  it('detects VS Code Copilot via the extensions directory', () => {
    const extensions = join(home, '.vscode', 'extensions');
    mkdirSync(join(extensions, 'github.copilot-1.250.0'), { recursive: true });
    const ids = detectTools(env(), project).map((t) => t.id);
    expect(ids).toContain('copilot');
  });

  it('detects Claude Code from ~/.claude.json', () => {
    writeFileSync(join(home, '.claude.json'), '{}');
    const ids = detectTools(env(), project).map((t) => t.id);
    expect(ids).toContain('claude-code');
  });
});

describe('appDataPath', () => {
  it('uses APPDATA on Windows and Application Support on macOS', () => {
    expect(appDataPath(env('win32'), 'Claude')).toBe(join(appData, 'Claude'));
    expect(appDataPath(env('darwin'), 'Claude')).toBe(
      join(home, 'Library', 'Application Support', 'Claude'),
    );
    expect(appDataPath(env('linux'), 'Claude')).toBe(join(home, '.config', 'Claude'));
  });
});
