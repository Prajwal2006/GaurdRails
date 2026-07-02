import { describe, expect, it } from 'vitest';
import { createAuditEvent } from './event.js';

describe('createAuditEvent', () => {
  it('stamps a generated id and ISO timestamp', () => {
    const event = createAuditEvent(
      { action: 'deny', reason: 'blocked' },
      { now: () => new Date('2026-01-02T03:04:05.000Z'), id: () => 'fixed-id' },
    );
    expect(event.id).toBe('fixed-id');
    expect(event.timestamp).toBe('2026-01-02T03:04:05.000Z');
    expect(event.action).toBe('deny');
    expect(event.reason).toBe('blocked');
  });

  it('omits optional fields when not provided', () => {
    const event = createAuditEvent(
      { action: 'allow', reason: 'ok' },
      { now: () => new Date(0), id: () => 'x' },
    );
    expect('tool' in event).toBe(false);
    expect('path' in event).toBe(false);
    expect('policyId' in event).toBe(false);
    expect('ruleId' in event).toBe(false);
    expect('findings' in event).toBe(false);
  });

  it('includes optional fields when provided', () => {
    const event = createAuditEvent(
      {
        action: 'redact',
        reason: 'masked',
        tool: 'claude-code',
        path: 'src/.env',
        policyId: 'default',
        ruleId: 'deny-high',
        findings: [{ detectorId: 'openai', category: 'api-key', severity: 'high' }],
      },
      { now: () => new Date(0), id: () => 'x' },
    );
    expect(event.tool).toBe('claude-code');
    expect(event.path).toBe('src/.env');
    expect(event.policyId).toBe('default');
    expect(event.ruleId).toBe('deny-high');
    expect(event.findings).toHaveLength(1);
  });

  it('uses real defaults when no deps are supplied', () => {
    const event = createAuditEvent({ action: 'audit-only', reason: 'noted' });
    expect(event.id).toMatch(/[0-9a-f-]{36}/i);
    expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
  });
});
