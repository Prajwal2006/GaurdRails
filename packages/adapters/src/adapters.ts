import type { AgentAdapter, AgentId, FileReadRequest, MediatedResponse } from '@guardrails/shared';
import { normalizeFileRequest } from './normalize.js';

/** Response shape used by MCP-style tools (Claude Code, Gemini CLI, Cursor). */
function mcpContentResponse(response: MediatedResponse): unknown {
  if (!response.allowed) {
    return {
      isError: true,
      content: [{ type: 'text', text: response.message ?? 'Access denied by Guardrails.' }],
    };
  }
  const text = response.content ?? '';
  const parts = [{ type: 'text', text }];
  if (response.message !== undefined) parts.push({ type: 'text', text: response.message });
  return { isError: false, content: parts };
}

/** Response shape used by tools that expect a flat object (Copilot, Codex). */
function flatResponse(response: MediatedResponse): unknown {
  return {
    allowed: response.allowed,
    ...(response.content !== undefined ? { content: response.content } : {}),
    ...(response.message !== undefined ? { message: response.message } : {}),
  };
}

interface AdapterConfig {
  readonly id: AgentId;
  readonly displayName: string;
  readonly format: (response: MediatedResponse) => unknown;
}

class ToolAdapter implements AgentAdapter {
  readonly id: AgentId;
  readonly displayName: string;
  private readonly format: (response: MediatedResponse) => unknown;

  constructor(config: AdapterConfig) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.format = config.format;
  }

  normalizeRequest(raw: unknown): FileReadRequest {
    return normalizeFileRequest(this.id, raw);
  }

  formatResponse(response: MediatedResponse): unknown {
    return this.format(response);
  }
}

export const claudeCodeAdapter: AgentAdapter = new ToolAdapter({
  id: 'claude-code',
  displayName: 'Claude Code',
  format: mcpContentResponse,
});

export const geminiCliAdapter: AgentAdapter = new ToolAdapter({
  id: 'gemini-cli',
  displayName: 'Gemini CLI',
  format: mcpContentResponse,
});

export const cursorAdapter: AgentAdapter = new ToolAdapter({
  id: 'cursor',
  displayName: 'Cursor',
  format: mcpContentResponse,
});

export const windsurfAdapter: AgentAdapter = new ToolAdapter({
  id: 'windsurf',
  displayName: 'Windsurf',
  format: mcpContentResponse,
});

export const copilotAdapter: AgentAdapter = new ToolAdapter({
  id: 'copilot',
  displayName: 'GitHub Copilot',
  format: flatResponse,
});

export const codexAdapter: AgentAdapter = new ToolAdapter({
  id: 'codex',
  displayName: 'OpenAI Codex',
  format: flatResponse,
});

/** Every adapter Guardrails ships with. */
export const BUILT_IN_ADAPTERS: readonly AgentAdapter[] = [
  claudeCodeAdapter,
  codexAdapter,
  copilotAdapter,
  geminiCliAdapter,
  cursorAdapter,
  windsurfAdapter,
];
