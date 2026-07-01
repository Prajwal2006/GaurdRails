import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { summarizeFindings, type ScanSummary } from '@guardrails/secret-detector';
import type { Finding } from '@guardrails/shared';
import type { Guardrails, InspectionResult } from './inspection.js';

export interface ScanOptions {
  /** Directory names to skip entirely. Sensible defaults are always applied. */
  readonly ignoreDirs?: readonly string[];
  /** Skip files larger than this many bytes. Default 512 KiB. */
  readonly maxFileSize?: number;
}

export interface FileScan {
  /** Path relative to the scan root, using forward slashes. */
  readonly path: string;
  readonly result: InspectionResult;
}

export interface ProjectScanResult {
  readonly root: string;
  /** Only files that produced at least one finding. */
  readonly files: readonly FileScan[];
  readonly filesScanned: number;
  readonly summary: ScanSummary;
}

const DEFAULT_IGNORE_DIRS: readonly string[] = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
];

const DEFAULT_MAX_FILE_SIZE = 512 * 1024;

function isProbablyBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8000);
  return sample.includes(0);
}

async function* walk(dir: string, ignore: ReadonlySet<string>): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory — skip
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue; // don't follow symlinks
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignore.has(entry.name)) continue;
      yield* walk(full, ignore);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/**
 * Scan a file or directory on disk for secrets. This is the only place in core
 * that touches the filesystem; the detection itself remains pure. Binary files,
 * oversized files, and ignored directories are skipped.
 */
export async function scanPath(
  target: string,
  guardrails: Guardrails,
  options: ScanOptions = {},
): Promise<ProjectScanResult> {
  const root = resolve(target);
  const ignore = new Set([...DEFAULT_IGNORE_DIRS, ...(options.ignoreDirs ?? [])]);
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

  const rootStat = await stat(root);
  const filePaths: string[] = [];
  if (rootStat.isDirectory()) {
    for await (const file of walk(root, ignore)) filePaths.push(file);
  } else {
    filePaths.push(root);
  }

  const files: FileScan[] = [];
  const allFindings: Finding[] = [];
  let filesScanned = 0;

  for (const filePath of filePaths) {
    let buffer: Buffer;
    try {
      const info = await stat(filePath);
      if (info.size > maxFileSize) continue;
      buffer = await readFile(filePath);
    } catch {
      continue; // unreadable file — skip
    }
    if (isProbablyBinary(buffer)) continue;

    filesScanned += 1;
    const relPath = (rootStat.isDirectory() ? relative(root, filePath) : filePath).replace(
      /\\/g,
      '/',
    );
    const result = guardrails.inspect({ path: relPath, content: buffer.toString('utf8') });
    if (result.findings.length > 0) {
      files.push({ path: relPath, result });
      allFindings.push(...result.findings);
    }
  }

  return { root, files, filesScanned, summary: summarizeFindings(allFindings) };
}
