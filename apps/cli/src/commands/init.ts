import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';
import { initConfig } from '../config.js';

/** `guardrails init` — scaffold `.guardrails/` config and default policy. */
export async function runInit(io: IO): Promise<number> {
  const { configPath, policyPath, alreadyExisted } = await initConfig();
  io.out(heading('Initializing Guardrails'));
  io.out('');
  if (alreadyExisted) {
    io.out(
      `  ${c.yellow(icon.warn)} Config already exists: ${c.cyan(configPath)} (left unchanged)`,
    );
  } else {
    io.out(`  ${c.green(icon.check)} Created ${c.cyan(configPath)}`);
  }
  io.out(`  ${c.green(icon.check)} Default policy at ${c.cyan(policyPath)}`);
  io.out('');
  io.out(c.dim('Next: run `guardrails scan` to check your project, or `guardrails git install`.'));
  return 0;
}
