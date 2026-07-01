import type { AgentId, FileReadRequest, MediatedResponse } from '@guardrails/shared';
import type { Mediator } from './mediator.js';
import type { FileSource } from './file-source.js';
import {
  METHOD_NOT_FOUND,
  failure,
  parseRequest,
  success,
  type JsonRpcId,
  type JsonRpcResponse,
} from './jsonrpc.js';

/** The MCP protocol version this server implements. */
export const PROTOCOL_VERSION = '2024-11-05';

export interface McpServerOptions {
  readonly mediator: Mediator;
  readonly source: FileSource;
  /** Tool id to attribute mediated requests to. Default `claude-code`. */
  readonly tool?: AgentId;
  readonly name?: string;
  readonly version?: string;
}

interface ToolContent {
  readonly content: Array<{ type: 'text'; text: string }>;
  readonly isError?: boolean;
}

const TOOLS = [
  {
    name: 'read_file',
    description:
      'Read a file through Guardrails. Secrets are redacted or the file is withheld per policy.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Path relative to the served root.' } },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: 'List files that Guardrails permits sharing (denied files are omitted).',
    inputSchema: { type: 'object', properties: {} },
  },
] as const;

function textResult(text: string, isError = false): ToolContent {
  return isError
    ? { content: [{ type: 'text', text }], isError: true }
    : { content: [{ type: 'text', text }] };
}

function responseToToolContent(response: MediatedResponse): ToolContent {
  if (!response.allowed) {
    return textResult(response.message ?? 'Access denied by Guardrails.', true);
  }
  const body = response.content ?? '';
  const text = response.message === undefined ? body : `${body}\n\n[${response.message}]`;
  return textResult(text);
}

/**
 * An MCP server that exposes exactly two tools — `read_file` and `list_files` —
 * both mediated by Guardrails so an AI client can only ever see approved,
 * secret-free content. Transport-agnostic: feed it parsed messages via
 * `handle`; see `serveStdio` for the stdio transport.
 */
export class McpServer {
  private readonly mediator: Mediator;
  private readonly source: FileSource;
  private readonly tool: AgentId;
  private readonly name: string;
  private readonly version: string;

  constructor(options: McpServerOptions) {
    this.mediator = options.mediator;
    this.source = options.source;
    this.tool = options.tool ?? 'claude-code';
    this.name = options.name ?? 'guardrails';
    this.version = options.version ?? '0.1.0';
  }

  /** Handle a single JSON-RPC message. Returns null for notifications. */
  async handle(message: unknown): Promise<JsonRpcResponse | null> {
    const request = parseRequest(message);
    if (request === undefined) {
      return failure(null, METHOD_NOT_FOUND, 'Invalid JSON-RPC request');
    }
    const id: JsonRpcId = request.id ?? null;
    const isNotification = request.id === undefined;

    switch (request.method) {
      case 'initialize':
        return success(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: this.name, version: this.version },
          capabilities: { tools: {} },
        });
      case 'notifications/initialized':
      case 'initialized':
        return null; // notification, no response
      case 'ping':
        return success(id, {});
      case 'tools/list':
        return success(id, { tools: TOOLS });
      case 'tools/call':
        return success(id, await this.callTool(request.params));
      default:
        if (isNotification) return null;
        return failure(id, METHOD_NOT_FOUND, `Unknown method: ${request.method}`);
    }
  }

  private async callTool(params: unknown): Promise<ToolContent> {
    const record = (typeof params === 'object' && params !== null ? params : {}) as Record<
      string,
      unknown
    >;
    const name = typeof record.name === 'string' ? record.name : '';
    const args = (
      typeof record.arguments === 'object' && record.arguments !== null ? record.arguments : {}
    ) as Record<string, unknown>;

    switch (name) {
      case 'read_file':
        return this.readFile(typeof args.path === 'string' ? args.path : '');
      case 'list_files':
        return this.listFiles();
      default:
        return textResult(`Unknown tool: ${name}`, true);
    }
  }

  private async readFile(path: string): Promise<ToolContent> {
    if (path.length === 0) return textResult('A "path" argument is required.', true);
    const content = await this.source.read(path);
    if (content === undefined) return textResult(`File not found or unreadable: ${path}`, true);
    const request: FileReadRequest = { tool: this.tool, path, content };
    const response = await this.mediator.mediate(request);
    return responseToToolContent(response);
  }

  private async listFiles(): Promise<ToolContent> {
    const paths = await this.source.list();
    const approved: string[] = [];
    for (const path of paths) {
      const content = await this.source.read(path);
      const request: FileReadRequest =
        content === undefined ? { tool: this.tool, path } : { tool: this.tool, path, content };
      const response = await this.mediator.mediate(request);
      if (response.allowed) {
        approved.push(response.message === undefined ? path : `${path} (redacted)`);
      }
    }
    const text =
      approved.length === 0
        ? 'No files are available to share.'
        : `Approved files (${approved.length}):\n${approved.join('\n')}`;
    return textResult(text);
  }
}
