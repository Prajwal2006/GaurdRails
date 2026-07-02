import { Guardrails, scanPath, type InspectionResult, type Outcome } from '@guardrails/core';
import { readStagedContent, stagedFiles } from './git-io.js';

export interface VerifiedFile {
  readonly path: string;
  readonly result: InspectionResult;
}

export interface VerifyResult {
  readonly files: readonly VerifiedFile[];
  readonly filesScanned: number;
  /** True when at least one finding should stop the git operation. */
  readonly blocked: boolean;
}

const NUL = String.fromCharCode(0);

/** A verdict blocks a commit/push when it would deny or redact real content. */
function blocks(outcome: Outcome): boolean {
  return outcome === 'deny' || outcome === 'redact';
}

/** Scan the staged (index) content of a commit — exactly what would be committed. */
export async function verifyStaged(
  cwd: string,
  guardrails: Guardrails = new Guardrails(),
): Promise<VerifyResult> {
  const staged = await stagedFiles(cwd);
  const files: VerifiedFile[] = [];
  let blocked = false;

  for (const path of staged) {
    let content: string;
    try {
      content = await readStagedContent(cwd, path);
    } catch {
      continue;
    }
    if (content.includes(NUL)) continue; // binary blob

    const result = guardrails.inspect({ path, content });
    if (result.findings.length > 0) {
      files.push({ path, result });
      if (blocks(result.outcome)) blocked = true;
    }
  }

  return { files, filesScanned: staged.length, blocked };
}

/** Scan the working tree of a repository (used by the pre-push hook). */
export async function verifyRepo(
  root: string,
  guardrails: Guardrails = new Guardrails(),
): Promise<VerifyResult> {
  const scan = await scanPath(root, guardrails);
  const files = scan.files.map((f) => ({ path: f.path, result: f.result }));
  const blocked = files.some((f) => blocks(f.result.outcome));
  return { files, filesScanned: scan.filesScanned, blocked };
}
