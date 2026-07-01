import { defaultCatalog, resolveExplanation } from '@guardrails/core';
import { renderExplanation, type ExperienceLevel } from '@guardrails/shared';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';

function listTerms(io: IO): void {
  const ids = defaultCatalog.all().map((e) => e.id);
  io.out(c.dim(`Available topics: ${ids.join(', ')}`));
  io.out(c.dim('You can also use aliases like `openai`, `aws`, `postgres`, `ssh`, `dotenv`.'));
}

/** `guardrails explain <type>` — beginner-friendly education about a risk. */
export function runExplain(term: string | undefined, level: ExperienceLevel, io: IO): number {
  if (term === undefined || term.trim() === '') {
    io.err(`${icon.warn} Usage: guardrails explain <type>`);
    listTerms(io);
    return 1;
  }

  const explanation = resolveExplanation(term);
  if (explanation === undefined) {
    io.err(`${icon.cross} No explanation found for "${term}".`);
    listTerms(io);
    return 1;
  }

  const rendered = renderExplanation(explanation, level);
  io.out(heading(rendered.title));
  io.out('');
  io.out(c.bold('What happened'));
  io.out(`  ${rendered.what}`);
  io.out('');
  io.out(c.bold('Why it matters'));
  io.out(`  ${rendered.why}`);
  io.out('');
  io.out(c.bold('How to fix it'));
  for (const step of rendered.fix) io.out(`  ${icon.arrow} ${step}`);
  io.out('');
  io.out(c.bold('How to prevent it next time'));
  for (const step of rendered.prevent) io.out(`  ${icon.bullet} ${step}`);
  return 0;
}
