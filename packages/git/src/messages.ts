import type { Severity } from '@guardrails/shared';
import type { GitScanResult } from './scanner.js';
import type { GitHook } from './hooks.js';
import { suggestFixes } from './autofix.js';

const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const HOOK_ACTION: Record<GitHook, string> = {
  'pre-commit': 'commit',
  'pre-push': 'push',
};

/**
 * Build a friendly, educational block message explaining why a commit/push was
 * stopped and how to fix it. Returns plain lines (no color) so it renders well
 * in any git client. Never includes a raw secret value.
 */
export function formatBlockMessage(result: GitScanResult, hook: GitHook): string[] {
  const lines: string[] = [];
  const action = HOOK_ACTION[hook];
  const count = result.findings.length;

  lines.push('');
  lines.push(`🛡️  Guardrails stopped this ${action} - it would publish your secrets.`);
  lines.push('');
  lines.push('In plain words: you are about to ' + action + ' files that hold passwords or');
  lines.push('API keys (a .env file, for example). Once they reach GitHub or any git server,');
  lines.push('every person, bot, and AI tool that can see the repository can read them and');
  lines.push('use your accounts. Nothing has been shared yet - Guardrails caught it in time.');
  lines.push('');
  lines.push(
    `Found ${count} potential secret${count === 1 ? '' : 's'} in ${result.files.length} file${
      result.files.length === 1 ? '' : 's'
    }:`,
  );
  lines.push('');

  for (const file of result.files) {
    lines.push(`  ${file.path}`);
    for (const { finding, decision } of file.result.decided) {
      const loc = finding.line === undefined ? '' : `:${finding.line}`;
      lines.push(
        `    [${finding.severity.toUpperCase()}] ${finding.title}${loc} - ${decision.action} (${finding.redactedPreview})`,
      );
    }
  }
  lines.push('');

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of result.findings) counts[f.severity] += 1;
  const summary = SEVERITY_ORDER.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s}`)
    .join(', ');
  lines.push(`Summary: ${summary}.`);
  lines.push('');

  const fixes = suggestFixes(result);
  if (fixes.length > 0) {
    lines.push('How to fix it:');
    for (const fix of fixes) {
      lines.push(`  • ${fix.title}: ${fix.detail}`);
      if (fix.command !== undefined) lines.push(`      run: ${fix.command}`);
    }
    lines.push('');
  }

  lines.push(`Once resolved, simply retry your ${action}.`);
  lines.push(`To ${action} anyway (not recommended), pass --no-verify.`);
  lines.push('');

  return lines;
}
