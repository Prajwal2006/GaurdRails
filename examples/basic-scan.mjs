// Basic usage of the Guardrails secret-detection engine.
//
//   pnpm install && pnpm build
//   node examples/basic-scan.mjs
//
// Everything runs locally — no network, no telemetry.

import { DetectorRegistry, summarizeFindings } from '@guardrails/secret-detector';

const registry = DetectorRegistry.withDefaults();

const sample = `
# Example config (do NOT do this in real life)
OPENAI_API_KEY=sk-ExampleExampleExampleExampleExampleExample01
DATABASE_URL=postgres://admin:hunter2@db.internal:5432/app
GREETING=hello world
`;

const findings = registry.scan({ path: 'config.env', content: sample });
const summary = summarizeFindings(findings);

console.log(`Found ${summary.total} issue(s). Highest severity: ${summary.highestSeverity}\n`);
for (const f of findings) {
  const where = f.line ? `line ${f.line}` : 'file';
  console.log(`  [${f.severity}] ${f.title} (${where}) → ${f.redactedPreview}`);
}
