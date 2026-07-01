import { createDefaultPolicy } from '@guardrails/core';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';
import { loadConfig } from '../config.js';

/** `guardrails policies` — list policies and their rules. */
export async function runPolicies(io: IO): Promise<number> {
  const { config } = await loadConfig();
  const policy = createDefaultPolicy();

  io.out(heading('Policies'));
  io.out('');
  io.out(`  Active policy: ${c.cyan(config.activePolicy)}`);
  io.out('');
  io.out(`  ${c.bold(policy.id)} ${c.gray(`— ${policy.description ?? ''}`)}`);
  io.out(`  default action: ${c.cyan(policy.defaultAction ?? 'fail-safe')}`);
  for (const rule of policy.rules) {
    io.out(`    ${icon.bullet} ${c.bold(rule.id)} ${c.gray(`→ ${rule.action}`)}`);
    if (rule.description) io.out(`        ${c.dim(rule.description)}`);
  }
  return 0;
}

/** `guardrails config` — print the effective configuration as JSON. */
export async function runConfig(io: IO): Promise<number> {
  const { config, path } = await loadConfig();
  io.out(JSON.stringify({ ...config, source: path ?? 'defaults' }, null, 2));
  return 0;
}
