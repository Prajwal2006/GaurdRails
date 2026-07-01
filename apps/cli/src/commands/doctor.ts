import { execFileSync } from 'node:child_process';
import { DetectorRegistry } from '@guardrails/core';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';
import { loadConfig } from '../config.js';

interface Check {
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
}

function checkNode(): Check {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  return {
    label: 'Node.js >= 20',
    ok: major >= 20,
    detail: `found ${process.versions.node}`,
  };
}

function checkGit(): Check {
  try {
    const version = execFileSync('git', ['--version'], { encoding: 'utf8' }).trim();
    return { label: 'git available', ok: true, detail: version };
  } catch {
    return { label: 'git available', ok: false, detail: 'git not found on PATH' };
  }
}

function checkDetectors(): Check {
  const count = DetectorRegistry.withDefaults().size;
  return { label: 'detectors loaded', ok: count > 0, detail: `${count} detectors` };
}

/** `guardrails doctor` — verify the environment is ready. */
export async function runDoctor(io: IO): Promise<number> {
  const { path } = await loadConfig();
  const checks: Check[] = [
    checkNode(),
    checkGit(),
    checkDetectors(),
    {
      label: 'project config',
      ok: true,
      detail: path ? path : 'using built-in defaults (run `guardrails init`)',
    },
  ];

  io.out(heading('Guardrails doctor'));
  io.out('');
  let allOk = true;
  for (const check of checks) {
    const mark = check.ok ? c.green(icon.check) : c.red(icon.cross);
    if (!check.ok) allOk = false;
    io.out(`  ${mark} ${check.label} ${c.gray(`(${check.detail})`)}`);
  }
  io.out('');
  io.out(
    allOk
      ? c.green(`${icon.check} Everything looks good.`)
      : c.yellow(`${icon.warn} Some checks need attention.`),
  );
  return allOk ? 0 : 1;
}
