/**
 * @guardrails/shield - detects the AI coding tools on a machine and writes
 * the enforcement configuration that keeps each of them away from secrets:
 * hard read-deny rules (Claude Code), AI ignore files (Cursor, Windsurf,
 * Gemini), MCP registration everywhere, and standing instructions where no
 * hard mechanism exists (Codex, Copilot). Zero manual JSON editing.
 */

export {
  detectTools,
  defaultShieldEnv,
  appDataPath,
  SHIELDABLE_TOOL_IDS,
  type DetectedTool,
  type ShieldEnv,
  type ShieldableToolId,
} from './detect.js';
export {
  shieldProject,
  type EnforcementLevel,
  type ShieldAction,
  type ShieldOptions,
  type ShieldReport,
  type ToolShieldResult,
} from './apply.js';
export {
  ensureManagedBlock,
  removeManagedBlock,
  hashMarkers,
  htmlMarkers,
  type ManagedMarkers,
  type ManagedStatus,
} from './managed.js';
export {
  mergeJsonFile,
  objectAt,
  addToStringArray,
  type JsonEditResult,
  type JsonObject,
  type JsonStatus,
} from './json-file.js';
export { SECRET_IGNORE_PATTERNS, CLAUDE_DENY_RULES, ADVISORY_LINES } from './constants.js';
