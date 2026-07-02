import { describe, expect, it } from 'vitest';
import { Guardrails, PolicyEngine } from '@guardrails/core';
import type { Policy } from '@guardrails/shared';
import { McpServer, PROTOCOL_VERSION } from './server.js';
import { Mediator } from './mediator.js';
import type { FileSource } from './file-source.js';

const OPENAI = 'sk-' + 'a'.repeat(40);

function source(files: Record<string, string>): FileSource {
  return {
    list: () => Promise.resolve(Object.keys(files)),
    read: (path) => Promise.resolve(files[path]),
  };
}

function server(files: Record<string, string>): McpServer {
  return new McpServer({ mediator: new Mediator(), source: source(files) });
}

describe('McpServer protocol', () => {
  it('responds to initialize with server info and protocol version', async () => {
    const res = await server({}).handle({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    expect(res).not.toBeNull();
    const result = (res as { result: { protocolVersion: string; serverInfo: { name: string } } })
      .result;
    expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(result.serverInfo.name).toBe('guardrails');
  });

  it('returns null for the initialized notification', async () => {
    expect(
      await server({}).handle({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    ).toBeNull();
  });

  it('answers ping', async () => {
    const res = await server({}).handle({ jsonrpc: '2.0', id: 2, method: 'ping' });
    expect((res as { result: unknown }).result).toEqual({});
  });

  it('lists the two mediated tools', async () => {
    const res = await server({}).handle({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
    const tools = (res as { result: { tools: Array<{ name: string }> } }).result.tools;
    expect(tools.map((t) => t.name)).toEqual(['read_file', 'list_files']);
  });

  it('rejects an unknown method', async () => {
    const res = await server({}).handle({ jsonrpc: '2.0', id: 4, method: 'nope' });
    expect((res as { error: { code: number } }).error.code).toBe(-32601);
  });

  it('rejects malformed messages', async () => {
    const res = await server({}).handle({ not: 'jsonrpc' });
    expect((res as { error: unknown }).error).toBeDefined();
  });

  it('ignores unknown notifications', async () => {
    expect(await server({}).handle({ jsonrpc: '2.0', method: 'random/notice' })).toBeNull();
  });
});

describe('read_file tool', () => {
  it('returns clean file content', async () => {
    const res = await server({ 'a.ts': 'export const x = 1;\n' }).handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'read_file', arguments: { path: 'a.ts' } },
    });
    const result = (res as { result: { content: Array<{ text: string }>; isError?: boolean } })
      .result;
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('export const x');
  });

  it('serves a sensitive file as a redacted copy and never leaks the secret', async () => {
    const res = await server({ '.env': `OPENAI_API_KEY=${OPENAI}\n` }).handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'read_file', arguments: { path: '.env' } },
    });
    const result = (res as { result: { content: Array<{ text: string }>; isError?: boolean } })
      .result;
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).not.toContain(OPENAI);
    expect(result.content[0]?.text).toContain('OPENAI_API_KEY=<REDACTED>');
    expect(result.content[0]?.text).toContain('Guardrails protected');
  });

  it('withholds a sensitive file entirely in withhold mode', async () => {
    const srv = new McpServer({
      mediator: new Mediator({ denyMode: 'withhold' }),
      source: source({ '.env': `OPENAI_API_KEY=${OPENAI}\n` }),
    });
    const res = await srv.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'read_file', arguments: { path: '.env' } },
    });
    const result = (res as { result: { content: Array<{ text: string }>; isError?: boolean } })
      .result;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).not.toContain(OPENAI);
  });

  it('errors on a missing file and on a missing path argument', async () => {
    const srv = server({});
    const missing = await srv.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'read_file', arguments: { path: 'gone.ts' } },
    });
    expect((missing as { result: { isError: boolean } }).result.isError).toBe(true);

    const noArg = await srv.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'read_file', arguments: {} },
    });
    expect((noArg as { result: { isError: boolean } }).result.isError).toBe(true);
  });

  it('rejects an unknown tool', async () => {
    const res = await server({}).handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'delete_everything', arguments: {} },
    });
    expect((res as { result: { isError: boolean } }).result.isError).toBe(true);
  });
});

describe('list_files tool', () => {
  it('marks sensitive files as redacted and leaves clean files unmarked', async () => {
    const res = await server({
      'ok.ts': 'export const x = 1;\n',
      '.env': `OPENAI_API_KEY=${OPENAI}\n`,
    }).handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'list_files' },
    });
    const text = (res as { result: { content: Array<{ text: string }> } }).result.content[0]?.text;
    expect(text).toContain('ok.ts');
    expect(text).toContain('.env (redacted)');
    expect(text).not.toContain('ok.ts (redacted)');
  });

  it('omits withheld files entirely in withhold mode', async () => {
    const srv = new McpServer({
      mediator: new Mediator({ denyMode: 'withhold' }),
      source: source({ '.env': `OPENAI_API_KEY=${OPENAI}\n` }),
    });
    const res = await srv.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'list_files' },
    });
    const text = (res as { result: { content: Array<{ text: string }> } }).result.content[0]?.text;
    expect(text).toContain('No files');
  });

  it('marks redacted files in the listing', async () => {
    const policy: Policy = { id: 'r', defaultAction: 'redact', rules: [] };
    const mediator = new Mediator({
      guardrails: new Guardrails({ engine: new PolicyEngine([policy], 'r') }),
    });
    const srv = new McpServer({
      mediator,
      source: source({ 'config.ts': `const k="${OPENAI}";` }),
    });
    const res = await srv.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'list_files' },
    });
    const text = (res as { result: { content: Array<{ text: string }> } }).result.content[0]?.text;
    expect(text).toContain('config.ts (redacted)');
  });
});
