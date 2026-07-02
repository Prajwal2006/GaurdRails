/**
 * @guardrails/agent-adapters — normalises each AI coding tool (Claude Code,
 * Codex, Copilot, Gemini CLI, Cursor, Windsurf, …) to Guardrails' neutral
 * request/response shape. Adding a new tool is a single `createAgentAdapter` call.
 */

export { createAgentAdapter } from './base.js';
export type { AdapterConfig } from './base.js';
export {
  claudeCodeAdapter,
  codexAdapter,
  copilotAdapter,
  geminiCliAdapter,
  cursorAdapter,
  windsurfAdapter,
  builtinAdapters,
  getAdapter,
  listAdapters,
} from './adapters.js';
