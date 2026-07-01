import { summarizeFindings, type ScanSummary } from '@guardrails/core';
import type { Finding } from '@guardrails/shared';
import type { Guardrails, InspectionResult, Outcome } from '@guardrails/core';
import type { GitRepo } from './git.js';

export interface GitScanOptions {
  /** Skip files larger than this many bytes. Default 512 KiB. */
  readonly maxFileSize?: number;
}

/** A single scanned file that produced at least one finding. */
export interface ScannedFile {
  readonly path: string;
  readonly result: InspectionResult;
}

export interface GitScanResult {
  /** Files that produced at least one finding. */
  readonly files: readonly ScannedFile[];
  readonly filesScanned: number;
  readonly findings: readonly Finding[];
  readonly summary: ScanSummary;
  /** Worst outcome across all files. */
  readonly outcome: Outcome;
  /** True when the worst outcome is a block (`deny`). */
  readonly blocked: boolean;
}

const OUTCOME_RANK: Record<Outcome, number> = { clean: 0, audit: 1, redact: 2, deny: 3 };
const DEFAULT_MAX_FILE_SIZE = 512 * 1024;

function worst(a: Outcome, b: Outcome): Outcome {
  return OUTCOME_RANK[a] >= OUTCOME_RANK[b] ? a : b;
}

/** A cheap binary check: real secrets live in text files. */
function looksBinary(content: string): boolean {
  return content.includes('\0');
}

interface Source {
  list(): Promise<string[]>;
  read(path: string): Promise<string | undefined>;
}

async function scanSource(
  source: Source,
  guardrails: Guardrails,
  options: GitScanOptions,
): Promise<GitScanResult> {
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const paths = await source.list();

  const files: ScannedFile[] = [];
  const allFindings: Finding[] = [];
  let filesScanned = 0;
  let outcome: Outcome = 'clean';

  for (const path of paths) {
    const content = await source.read(path);
    if (content === undefined) continue;
    if (Buffer.byteLength(content, 'utf8') > maxFileSize) continue;
    if (looksBinary(content)) continue;

    filesScanned += 1;
    const result = guardrails.inspect({ path, content });
    outcome = worst(outcome, result.outcome);
    if (result.findings.length > 0) {
      files.push({ path, result });
      allFindings.push(...result.findings);
    }
  }

  return {
    files,
    filesScanned,
    findings: allFindings,
    summary: summarizeFindings(allFindings),
    outcome,
    blocked: outcome === 'deny',
  };
}

/** Scan everything staged for commit (the index). Used by the pre-commit hook. */
export function scanStaged(
  repo: GitRepo,
  guardrails: Guardrails,
  options: GitScanOptions = {},
): Promise<GitScanResult> {
  return scanSource(
    {
      list: () => repo.listStagedFiles(),
      read: (path) => repo.readStagedContent(path),
    },
    guardrails,
    options,
  );
}

/** Scan every tracked file in the working tree. Used by the pre-push hook. */
export function scanTracked(
  repo: GitRepo,
  guardrails: Guardrails,
  options: GitScanOptions = {},
): Promise<GitScanResult> {
  return scanSource(
    {
      list: () => repo.listTrackedFiles(),
      read: (path) => repo.readWorkingContent(path),
    },
    guardrails,
    options,
  );
}
