import { describe, expect, it } from 'vitest';
import { PolicyEngine } from '@guardrails/policy-engine';
import { Guardrails } from './inspection.js';

const OPENAI = 'sk-' + 'a'.repeat(40);

describe('Guardrails.inspect', () => {
  it('denies a high-severity secret under the default policy', () => {
    const result = new Guardrails().inspect({ path: 'config.ts', content: `KEY=${OPENAI}` });
    expect(result.findings).toHaveLength(1);
    expect(result.decided[0]?.decision.action).toBe('deny');
    expect(result.outcome).toBe('deny');
  });

  it('reports a clean verdict for benign content', () => {
    const result = new Guardrails().inspect({
      path: 'index.ts',
      content: 'export const x = 1;\n',
    });
    expect(result.findings).toHaveLength(0);
    expect(result.outcome).toBe('clean');
  });

  it('denies a sensitive file by name', () => {
    const result = new Guardrails().inspect({ path: '.env', content: 'FOO=bar\n' });
    expect(result.outcome).toBe('deny');
  });

  it('takes the worst outcome across findings', () => {
    const content = `LOG_LEVEL=debug\nAPI_KEY=${OPENAI}\n`;
    const result = new Guardrails().inspect({ path: 'a.ts', content });
    expect(result.outcome).toBe('deny');
  });
});

describe('Guardrails.redact', () => {
  it('masks blocked/redacted findings and never leaks the value', () => {
    const { content, redactions, result } = new Guardrails().redact({
      path: 'config.ts',
      content: `OPENAI_API_KEY=${OPENAI}`,
    });
    expect(content).toBe('OPENAI_API_KEY=<REDACTED>');
    expect(redactions).toBe(1);
    expect(content).not.toContain(OPENAI);
    expect(result.outcome).toBe('deny');
  });

  it('honours a custom policy that redacts instead of denies', () => {
    const engine = new PolicyEngine(
      [{ id: 'redact-all', rules: [{ id: 'r', action: 'redact', minSeverity: 'info' }] }],
      'redact-all',
    );
    const { content, result } = new Guardrails({ engine }).redact({
      path: 'a.ts',
      content: `KEY=${OPENAI}`,
    });
    expect(result.decided[0]?.decision.action).toBe('redact');
    expect(content).toBe('KEY=<REDACTED>');
  });
});
