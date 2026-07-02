import type { AgentAdapter, AgentId } from '@guardrails/shared';
import { createAgentAdapter } from './base.js';

// Each supported AI tool is one line. Cursor and Windsurf commonly reference
// files by URI, but the default path keys already cover that.
export const claudeCodeAdapter = createAgentAdapter({
  id: 'claude-code',
  displayName: 'Claude Code',
});
export const codexAdapter = createAgentAdapter({ id: 'codex', displayName: 'Codex' });
export const copilotAdapter = createAgentAdapter({ id: 'copilot', displayName: 'GitHub Copilot' });
export const geminiCliAdapter = createAgentAdapter({ id: 'gemini-cli', displayName: 'Gemini CLI' });
export const cursorAdapter = createAgentAdapter({ id: 'cursor', displayName: 'Cursor' });
export const windsurfAdapter = createAgentAdapter({ id: 'windsurf', displayName: 'Windsurf' });

export const builtinAdapters: readonly AgentAdapter[] = [
  claudeCodeAdapter,
  codexAdapter,
  copilotAdapter,
  geminiCliAdapter,
  cursorAdapter,
  windsurfAdapter,
];

const byId = new Map<string, AgentAdapter>(builtinAdapters.map((a) => [a.id, a]));

/** Look up a built-in adapter by id. */
export function getAdapter(id: AgentId): AgentAdapter | undefined {
  return byId.get(id);
}

/** List all built-in adapters. */
export function listAdapters(): AgentAdapter[] {
  return [...byId.values()];
}
