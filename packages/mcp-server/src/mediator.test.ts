import { describe, expect, it } from 'vitest';
import { MemoryAuditSink } from '@guardrails/audit';
import { Guardrails, PolicyEngine } from '@guardrails/core';
import type { Policy } from '@guardrails/shared';
import { Mediator } from './mediator.js';

const OPENAI = 'sk-' + 'a'.repeat(40);

function guardrailsWithDefault(action: Policy['defaultAction']): Guardrails {
  const policy: Policy = { id: 'test', defaultAction: action, rules: [] };
  return new Guardrails({ engine: new PolicyEngine([policy], 'test') });
}

describe('Mediator', () => {
  it('denies content containing a high-severity secret and audits it', async () => {
    const audit = new MemoryAuditSink();
    const mediator = new Mediator({ audit });
    const response = await mediator.mediate({
      tool: 'claude-code',
      path: '.env',
      content: `OPENAI_API_KEY=${OPENAI}\n`,
    });
    expect(response.allowed).toBe(false);
    expect(response.content).toBeUndefined();
    expect(response.message).not.toContain(OPENAI);
    expect(audit.list()[0]?.action).toBe('deny');
  });

  it('allows clean content untouched', async () => {
    const mediator = new Mediator();
    const response = await mediator.mediate({
      tool: 'cursor',
      path: 'index.ts',
      content: 'export const x = 1;\n',
    });
    expect(response.allowed).toBe(true);
    expect(response.content).toBe('export const x = 1;\n');
  });

  it('honours the deny list before inspection', async () => {
    const audit = new MemoryAuditSink();
    const mediator = new Mediator({ deny: ['**/*.pem'], audit });
    const response = await mediator.mediate({
      tool: 'copilot',
      path: 'certs/server.pem',
      content: 'anything',
    });
    expect(response.allowed).toBe(false);
    expect(audit.list()[0]?.reason).toContain('deny list');
  });

  it('honours the allow list and bypasses inspection', async () => {
    const mediator = new Mediator({ allow: ['src/**'] });
    const response = await mediator.mediate({
      tool: 'codex',
      path: 'src/secret.ts',
      content: `const k = "${OPENAI}";\n`,
    });
    expect(response.allowed).toBe(true);
    expect(response.content).toContain(OPENAI); // allow list is explicit trust
  });

  it('reads content via readContent when the request omits it', async () => {
    const mediator = new Mediator({
      readContent: (path) => Promise.resolve(path === 'a.ts' ? 'export const y = 2;\n' : undefined),
    });
    const response = await mediator.mediate({ tool: 'gemini-cli', path: 'a.ts' });
    expect(response.allowed).toBe(true);
    expect(response.content).toBe('export const y = 2;\n');
  });

  it('allows-but-notes when there is nothing to inspect', async () => {
    const mediator = new Mediator();
    const response = await mediator.mediate({ tool: 'windsurf', path: 'unknown.ts' });
    expect(response.allowed).toBe(true);
    expect(response.message).toContain('not inspected');
  });

  it('works without an audit sink', async () => {
    const mediator = new Mediator();
    const response = await mediator.mediate({
      tool: 'claude-code',
      path: '.env',
      content: `OPENAI_API_KEY=${OPENAI}\n`,
    });
    expect(response.allowed).toBe(false);
  });

  it('redacts when the policy default is redact', async () => {
    const audit = new MemoryAuditSink();
    const mediator = new Mediator({ guardrails: guardrailsWithDefault('redact'), audit });
    const response = await mediator.mediate({
      tool: 'claude-code',
      path: 'config.ts',
      content: `const key = "${OPENAI}";\n`,
    });
    expect(response.allowed).toBe(true);
    expect(response.content).not.toContain(OPENAI);
    expect(response.message).toContain('redacted');
    expect(audit.list()[0]?.action).toBe('redact');
  });

  it('exposes with audit when the policy default is audit-only', async () => {
    const audit = new MemoryAuditSink();
    const mediator = new Mediator({ guardrails: guardrailsWithDefault('audit-only'), audit });
    const response = await mediator.mediate({
      tool: 'claude-code',
      path: 'config.ts',
      content: `const key = "${OPENAI}";\n`,
    });
    expect(response.allowed).toBe(true);
    expect(response.content).toContain(OPENAI);
    expect(audit.list()[0]?.action).toBe('audit-only');
  });
});
