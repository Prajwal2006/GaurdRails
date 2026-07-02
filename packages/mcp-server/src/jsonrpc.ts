/** Minimal JSON-RPC 2.0 message types used by the MCP server. */

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id?: JsonRpcId;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcSuccess {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly result: unknown;
}

export interface JsonRpcError {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly error: { readonly code: number; readonly message: string; readonly data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

// Standard JSON-RPC error codes.
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INTERNAL_ERROR = -32603;

export function success(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

export function failure(id: JsonRpcId, code: number, message: string): JsonRpcError {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/** Narrow unknown input to a well-formed JSON-RPC request. */
export function parseRequest(value: unknown): JsonRpcRequest | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (record.jsonrpc !== '2.0') return undefined;
  if (typeof record.method !== 'string') return undefined;
  const request: JsonRpcRequest = { jsonrpc: '2.0', method: record.method };
  return {
    ...request,
    ...(record.id !== undefined ? { id: record.id as JsonRpcId } : {}),
    ...(record.params !== undefined ? { params: record.params } : {}),
  };
}
