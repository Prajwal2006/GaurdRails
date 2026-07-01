import { describe, expect, it } from 'vitest';
import { failure, parseRequest, success } from './jsonrpc.js';

describe('jsonrpc', () => {
  it('builds success and error responses', () => {
    expect(success(1, { ok: true })).toEqual({ jsonrpc: '2.0', id: 1, result: { ok: true } });
    expect(failure(2, -32601, 'nope')).toEqual({
      jsonrpc: '2.0',
      id: 2,
      error: { code: -32601, message: 'nope' },
    });
  });

  it('parses a valid request with id and params', () => {
    const req = parseRequest({ jsonrpc: '2.0', id: 5, method: 'ping', params: { a: 1 } });
    expect(req).toEqual({ jsonrpc: '2.0', method: 'ping', id: 5, params: { a: 1 } });
  });

  it('parses a notification without an id', () => {
    const req = parseRequest({ jsonrpc: '2.0', method: 'notify' });
    expect(req?.method).toBe('notify');
    expect(req && 'id' in req).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(parseRequest(null)).toBeUndefined();
    expect(parseRequest({ jsonrpc: '1.0', method: 'x' })).toBeUndefined();
    expect(parseRequest({ jsonrpc: '2.0' })).toBeUndefined();
  });
});
