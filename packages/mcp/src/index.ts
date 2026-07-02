/**
 * @guardrails/mcp — a guarded MCP file server. It exposes only approved files to
 * AI tools: secrets are redacted, sensitive files are denied with a clear
 * message, and every decision can be audited — without ever emitting a raw value.
 */

export { GuardedFileServer, MemoryAuditSink, DENY_MESSAGE } from './server.js';
export type { GuardedFileServerOptions, ReadResult, ReadStatus } from './server.js';

export { handleMessage, READ_FILE_TOOL, SERVER_INFO, PROTOCOL_VERSION } from './protocol.js';
export type { JsonRpcResponse } from './protocol.js';

export { startStdioServer } from './stdio.js';
export type { StdioOptions } from './stdio.js';
