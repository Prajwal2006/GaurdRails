import { DetectorRegistry } from '@guardrails/core';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';
import { loadConfig } from '../config.js';

/** `guardrails status` — show the current configuration at a glance. */
export async function runStatus(io: IO): Promise<number> {
  const { config, path } = await loadConfig();
  io.out(heading('Guardrails status'));
  io.out('');
  io.out(
    `  ${icon.bullet} Config:            ${path ? c.cyan(path) : c.gray('(built-in defaults)')}`,
  );
  io.out(`  ${icon.bullet} Active policy:     ${c.cyan(config.activePolicy)}`);
  io.out(`  ${icon.bullet} Experience level:  ${c.cyan(config.experienceLevel)}`);
  io.out(
    `  ${icon.bullet} Detectors loaded:  ${c.cyan(String(DetectorRegistry.withDefaults().size))}`,
  );
  io.out(`  ${icon.bullet} Privacy:           ${c.green('local-only, no telemetry')}`);
  return 0;
}
