/**
 * @guardrails/git — git protection. Installs pre-commit / pre-push hooks and
 * scans staged content (or the working tree) for secrets before they leave your
 * machine.
 */

export { isGitRepo, repoRoot, gitDir, stagedFiles, readStagedContent } from './git-io.js';

export { installHooks, uninstallHooks, HOOK_MARKER, MANAGED_HOOKS } from './hooks.js';
export type {
  ManagedHook,
  InstallStatus,
  HookResult,
  UninstallStatus,
  UninstallResult,
} from './hooks.js';

export { verifyStaged, verifyRepo } from './verify.js';
export type { VerifyResult, VerifiedFile } from './verify.js';

export { addToGitignore } from './gitignore.js';
