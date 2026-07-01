import { writeFile } from 'node:fs/promises';
import { Guardrails, scanPath, type FileScan } from '@guardrails/core';
import type { IO } from '../io.js';
import { c, icon } from '../ui.js';

export type ReportFormat = 'md' | 'json';

export interface ReportCommandOptions {
  readonly format?: ReportFormat;
  readonly output?: string;
}

/** Build a Markdown report from scan results. Pure — easy to test. */
export function buildMarkdownReport(files: readonly FileScan[], filesScanned: number): string {
  const findings = files.flatMap((f) => f.result.findings);
  const lines: string[] = [];
  lines.push('# Guardrails security report', '');
  lines.push(`- Files scanned: **${filesScanned}**`);
  lines.push(`- Files with findings: **${files.length}**`);
  lines.push(`- Total findings: **${findings.length}**`, '');

  if (findings.length === 0) {
    lines.push('No secrets were found. 🎉', '');
    return lines.join('\n');
  }

  lines.push('## Findings', '');
  for (const file of files) {
    lines.push(`### \`${file.path}\``, '');
    lines.push('| Severity | Type | Location | Decision | Preview |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const { finding, decision } of file.result.decided) {
      const loc = finding.line ? `L${finding.line}` : '—';
      lines.push(
        `| ${finding.severity} | ${finding.title} | ${loc} | ${decision.action} | \`${finding.redactedPreview}\` |`,
      );
    }
    lines.push('');
  }

  lines.push('## Recommendations', '');
  lines.push('- Move secrets into environment variables or a secrets manager.');
  lines.push('- Rotate any credential that may have been exposed.');
  lines.push('- Add sensitive files to `.gitignore` and commit a `.env.example` instead.');
  lines.push('- Install the Guardrails git hooks to catch secrets before they are pushed.');
  lines.push('');
  return lines.join('\n');
}

/** `guardrails report [paths...]` — generate a Markdown or JSON report. */
export async function runReport(
  paths: readonly string[],
  options: ReportCommandOptions,
  io: IO,
): Promise<number> {
  const targets = paths.length > 0 ? [...paths] : ['.'];
  const format: ReportFormat = options.format ?? 'md';
  const guardrails = new Guardrails();

  const files: FileScan[] = [];
  let filesScanned = 0;
  for (const target of targets) {
    try {
      const result = await scanPath(target, guardrails);
      files.push(...result.files);
      filesScanned += result.filesScanned;
    } catch (error) {
      io.err(
        `${icon.cross} Cannot scan "${target}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return 2;
    }
  }

  const content =
    format === 'json'
      ? JSON.stringify(
          {
            filesScanned,
            filesWithFindings: files.length,
            files: files.map((f) => ({ path: f.path, findings: f.result.findings })),
          },
          null,
          2,
        )
      : buildMarkdownReport(files, filesScanned);

  if (options.output) {
    await writeFile(options.output, `${content}\n`);
    io.out(`${c.green(icon.check)} Report written to ${c.cyan(options.output)}`);
  } else {
    io.out(content);
  }
  return 0;
}
