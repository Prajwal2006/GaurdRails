/**
 * @guardrails/git - git protection. Scans staged/tracked files through the
 * Guardrails engine, installs reversible pre-commit/pre-push hooks, and
 * produces educational block messages with auto-fix suggestions.
 */

export {
  type GitRunner,
  type GitRepo,
  CliGitRepo,
  execGitRunner,
  openGitRepo,
  isGitRepository,
} from './git.js';

export {
  scanStaged,
  scanTracked,
  type GitScanOptions,
  type GitScanResult,
  type ScannedFile,
} from './scanner.js';

export {
  SUPPORTED_HOOKS,
  type GitHook,
  type HookOptions,
  type HookInstallResult,
  type HookUninstallResult,
  type HookStatus,
  type InstallStatus,
  type UninstallStatus,
  renderHookBlock,
  renderHookScript,
  installHook,
  installHooks,
  uninstallHook,
  uninstallHooks,
  hookStatus,
  hooksStatus,
} from './hooks.js';

export {
  type AutoFixSuggestion,
  type AppliedFix,
  suggestFixes,
  applyFixes,
  gitignorePatternsFor,
  ensureGitignore,
  writeEnvExample,
  buildEnvExample,
  isEnvFile,
} from './autofix.js';

export { formatBlockMessage } from './messages.js';
