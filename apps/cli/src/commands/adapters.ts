import { AdapterRegistry } from '@guardrails/adapters';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';

/** `guardrails adapters` - list the AI tools Guardrails can mediate. */
export function runAdapters(io: IO): number {
  const registry = AdapterRegistry.withDefaults();
  io.out(heading('Supported AI tools'));
  io.out('');
  for (const adapter of registry.list()) {
    io.out(`  ${icon.bullet} ${c.bold(adapter.displayName)} ${c.gray(`(${adapter.id})`)}`);
  }
  io.out('');
  io.out(
    c.dim(
      `${registry.size} adapter(s). Use \`guardrails mcp serve\` to mediate their file access.`,
    ),
  );
  return 0;
}
