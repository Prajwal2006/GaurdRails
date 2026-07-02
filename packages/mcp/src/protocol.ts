import type { GuardedFileServer } from './server.js';

export const SERVER_INFO = { name: 'guardrails', version: '0.1.0' } as const;
export const PROTOCOL_VERSION = '2024-11-05';

export const READ_FILE_TOOL = {
  name: 'read_file',
  description:
    'Read a file through Guardrails. Secrets are redacted and sensitive files are denied with an explanation.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the served root' },
    },
    required: ['path'],
  },
} as const;

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function reply(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function textError(message: string): ToolCallResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function handleToolCall(server: GuardedFileServer, params: unknown): Promise<ToolCallResult> {
  if (!isRecord(params) || typeof params.name !== 'string') return textError('Invalid tool call');
  if (params.name !== READ_FILE_TOOL.name) return textError(`Unknown tool: ${params.name}`);

  const args = isRecord(params.arguments) ? params.arguments : {};
  if (typeof args.path !== 'string') {
    return textError('read_file requires a "path" string argument');
  }

  const result = await server.read(args.path);
  if (result.status === 'error') return textError(result.message ?? 'read error');
  if (result.status === 'denied') {
    return { content: [{ type: 'text', text: result.message ?? 'Access denied.' }] };
  }
  return { content: [{ type: 'text', text: result.content ?? '' }] };
}

/**
 * Handle a single MCP (JSON-RPC 2.0) message. Returns a response, or `undefined`
 * for notifications. Transport-agnostic so it can be tested directly.
 */
export async function handleMessage(
  server: GuardedFileServer,
  message: unknown,
): Promise<JsonRpcResponse | undefined> {
  if (!isRecord(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
  }

  const id = typeof message.id === 'number' || typeof message.id === 'string' ? message.id : null;
  const isNotification = message.id === undefined || message.id === null;
  const method = message.method;

  if (method.startsWith('notifications/')) return undefined;

  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: [READ_FILE_TOOL] });
    case 'tools/call':
      return reply(id, await handleToolCall(server, message.params));
    default:
      if (isNotification) return undefined;
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}
