import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GuardedFileServer, DENY_MESSAGE } from './server.js';
import { handleMessage, READ_FILE_TOOL } from './protocol.js';

let root: string;
let server: GuardedFileServer;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'guardrails-mcp-proto-'));
  await writeFile(join(root, 'clean.ts'), 'export const x = 1;\n');
  await writeFile(join(root, '.env'), `OPENAI_API_KEY=sk-${'a'.repeat(40)}\n`);
  server = new GuardedFileServer({ root });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function rpc(method: string, params?: unknown, id: number | string | null = 1): unknown {
  return { jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}) };
}

describe('handleMessage', () => {
  it('responds to initialize with server info', async () => {
    const res = await handleMessage(server, rpc('initialize'));
    expect((res?.result as { serverInfo: { name: string } }).serverInfo.name).toBe('guardrails');
  });

  it('lists the read_file tool', async () => {
    const res = await handleMessage(server, rpc('tools/list'));
    const tools = (res?.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((t) => t.name)).toContain(READ_FILE_TOOL.name);
  });

  it('reads a clean file via tools/call', async () => {
    const res = await handleMessage(
      server,
      rpc('tools/call', { name: 'read_file', arguments: { path: 'clean.ts' } }),
    );
    const result = res?.result as { content: Array<{ text: string }> };
    expect(result.content[0]?.text).toContain('const x');
  });

  it('returns the denial message for a sensitive file', async () => {
    const res = await handleMessage(
      server,
      rpc('tools/call', { name: 'read_file', arguments: { path: '.env' } }),
    );
    const result = res?.result as { content: Array<{ text: string }> };
    expect(result.content[0]?.text).toBe(DENY_MESSAGE);
  });

  it('errors on an unknown tool', async () => {
    const res = await handleMessage(
      server,
      rpc('tools/call', { name: 'delete_everything', arguments: {} }),
    );
    const result = res?.result as { isError?: boolean };
    expect(result.isError).toBe(true);
  });

  it('returns method-not-found for unknown methods', async () => {
    const res = await handleMessage(server, rpc('do/stuff'));
    expect(res?.error?.code).toBe(-32601);
  });

  it('ignores notifications', async () => {
    const res = await handleMessage(server, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(res).toBeUndefined();
  });

  it('rejects malformed messages', async () => {
    const res = await handleMessage(server, { not: 'jsonrpc' });
    expect(res?.error?.code).toBe(-32600);
  });
});
