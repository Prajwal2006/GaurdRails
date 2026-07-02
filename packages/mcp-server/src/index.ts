/**
 * @guardrails/mcp-server - a Model Context Protocol server that mediates AI
 * file access through Guardrails. Exposes only approved, secret-free files and
 * records a value-free audit trail of every decision.
 */

export { Mediator, type MediatorOptions, type DenyMode } from './mediator.js';
export { diskFileSource, type FileSource } from './file-source.js';
export { McpServer, PROTOCOL_VERSION, type McpServerOptions } from './server.js';
export { serveStdio, type StdioOptions } from './stdio.js';
export {
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
  type JsonRpcError,
  type JsonRpcId,
} from './jsonrpc.js';
