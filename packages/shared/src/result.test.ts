import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, mapResult, ok, unwrap, unwrapOr } from './result.js';

describe('Result', () => {
  it('constructs ok and err', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  it('narrows with isOk / isErr', () => {
    const good = ok(42);
    const bad = err(new Error('x'));
    expect(isOk(good)).toBe(true);
    expect(isErr(good)).toBe(false);
    expect(isErr(bad)).toBe(true);
  });

  it('unwrap returns the value or throws the error', () => {
    expect(unwrap(ok('v'))).toBe('v');
    expect(() => unwrap(err(new Error('nope')))).toThrow('nope');
  });

  it('unwrap wraps non-Error errors', () => {
    expect(() => unwrap(err('plain'))).toThrow('plain');
  });

  it('unwrapOr returns fallback on error', () => {
    expect(unwrapOr(ok(1), 9)).toBe(1);
    expect(unwrapOr(err('e'), 9)).toBe(9);
  });

  it('mapResult maps ok and passes err through', () => {
    expect(mapResult(ok(2), (n) => n * 2)).toEqual(ok(4));
    const e = err('fail');
    expect(mapResult(e, (n: number) => n * 2)).toBe(e);
  });
});
