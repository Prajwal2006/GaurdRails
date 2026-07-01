import { Guardrails, scanPath, type FileScan } from '@guardrails/core';
import type { Severity } from '@guardrails/shared';
import type { IO } from '../io.js';
import { actionLabel, c, heading, icon, severityBadge } from '../ui.js';

export interface ScanCommandOptions {
  readonly json?: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

/** `guardrails scan [paths...]` - scan files/directories for secrets. */
export async function runScan(
  paths: readonly string[],
  options: ScanCommandOptions,
  io: IO,
): Promise<number> {
  const targets = paths.length > 0 ? [...paths] : ['.'];
  const guardrails = new Guardrails();

  const files: FileScan[] = [];
  let filesScanned = 0;
  for (const target of targets) {
    try {
      const result = await scanPath(target, guardrails);
      files.push(...result.files);
      filesScanned += result.filesScanned;
    } catch (error) {
      io.err(`${icon.cross} Cannot scan "${target}": ${errorMessage(error)}`);
      return 2;
    }
  }

  const allFindings = files.flatMap((f) => f.result.findings);

  if (options.json) {
    io.out(
      JSON.stringify(
        {
          filesScanned,
          filesWithFindings: files.length,
          totalFindings: allFindings.length,
          files: files.map((f) => ({
            path: f.path,
            outcome: f.result.outcome,
            findings: f.result.findings,
          })),
        },
        null,
        2,
      ),
    );
    return allFindings.length > 0 ? 1 : 0;
  }

  if (allFindings.length === 0) {
    io.out(`${icon.check} ${c.green('No secrets found.')} Scanned ${filesScanned} file(s).`);
    return 0;
  }

  io.out(
    heading(`Found ${allFindings.length} potential secret(s) across ${files.length} file(s):`),
  );
  io.out('');

  for (const file of files) {
    io.out(`  ${c.cyan(file.path)}`);
    for (const { finding, decision } of file.result.decided) {
      const loc = finding.line
        ? c.gray(`:${finding.line}${finding.column ? `:${finding.column}` : ''}`)
        : '';
      io.out(
        `    ${severityBadge(finding.severity)} ${finding.title}${loc}  ${actionLabel(decision.action)}`,
      );
      io.out(`        ${c.dim(finding.redactedPreview)}`);
    }
    io.out('');
  }

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of allFindings) counts[f.severity] += 1;
  const summary = SEVERITY_ORDER.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s}`)
    .join(', ');
  io.out(`${icon.info} ${c.bold('Summary:')} ${summary} - scanned ${filesScanned} file(s).`);
  io.out(
    c.dim(`Run \`guardrails explain <type>\` to learn what a finding means and how to fix it.`),
  );

  return 1;
}
