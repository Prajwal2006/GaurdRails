import { describe, expect, it } from 'vitest';
import { MemoryAuditSink } from './memory-sink.js';
import { createAuditEvent } from './event.js';

function event(reason: string): ReturnType<typeof createAuditEvent> {
  return createAuditEvent({ action: 'audit-only', reason });
}

describe('MemoryAuditSink', () => {
  it('records events and reports size', () => {
    const sink = new MemoryAuditSink();
    expect(sink.size).toBe(0);
    sink.record(event('a'));
    sink.record(event('b'));
    expect(sink.size).toBe(2);
  });

  it('lists events most-recent-first', () => {
    const sink = new MemoryAuditSink();
    sink.record(event('first'));
    sink.record(event('second'));
    expect(sink.list().map((e) => e.reason)).toEqual(['second', 'first']);
  });

  it('honours a limit', () => {
    const sink = new MemoryAuditSink();
    sink.record(event('a'));
    sink.record(event('b'));
    sink.record(event('c'));
    expect(sink.list(2).map((e) => e.reason)).toEqual(['c', 'b']);
    expect(sink.list(0)).toEqual([]);
  });

  it('clears recorded events', () => {
    const sink = new MemoryAuditSink();
    sink.record(event('a'));
    sink.clear();
    expect(sink.size).toBe(0);
    expect(sink.list()).toEqual([]);
  });
});
