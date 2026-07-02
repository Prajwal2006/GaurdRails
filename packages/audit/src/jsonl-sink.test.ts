import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonlAuditSink } from './jsonl-sink.js';
import { createAuditEvent } from './event.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'guardrails-audit-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function event(reason: string): ReturnType<typeof createAuditEvent> {
  return createAuditEvent({ action: 'deny', reason });
}

describe('JsonlAuditSink', () => {
  it('returns an empty list when the file does not exist', () => {
    const sink = new JsonlAuditSink(join(dir, 'nested', 'audit.jsonl'));
    expect(sink.list()).toEqual([]);
    expect(sink.path).toContain('audit.jsonl');
  });

  it('creates the directory and appends events', () => {
    const sink = new JsonlAuditSink(join(dir, 'logs', 'audit.jsonl'));
    sink.record(event('one'));
    sink.record(event('two'));
    expect(sink.list().map((e) => e.reason)).toEqual(['two', 'one']);
  });

  it('honours a limit', () => {
    const sink = new JsonlAuditSink(join(dir, 'audit.jsonl'));
    sink.record(event('a'));
    sink.record(event('b'));
    sink.record(event('c'));
    expect(sink.list(1).map((e) => e.reason)).toEqual(['c']);
  });

  it('skips corrupt lines without crashing', () => {
    const file = join(dir, 'audit.jsonl');
    const sink = new JsonlAuditSink(file);
    sink.record(event('good'));
    writeFileSync(file, `{"not":"valid"\n${JSON.stringify(event('also-good'))}\n`, {
      flag: 'a',
    });
    const listed = sink.list();
    expect(listed.some((e) => e.reason === 'good')).toBe(true);
    expect(listed.some((e) => e.reason === 'also-good')).toBe(true);
  });
});
