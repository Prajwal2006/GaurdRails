import { describe, expect, it } from 'vitest';
import type { Finding } from '@guardrails/shared';
import { Redactor, redactContent, redactEnvContent, redactValue } from './redactor.js';

function findingFor(content: string, needle: string): Finding {
  const index = content.indexOf(needle);
  return {
    detectorId: 'test',
    detectorKind: 'regex',
    title: 'Test secret',
    category: 'api-key',
    severity: 'high',
    confidence: 'high',
    length: needle.length,
    redactedPreview: 'preview',
    fingerprint: 'fp',
    index,
  };
}

describe('redactContent', () => {
  it('replaces a value while preserving surrounding structure', () => {
    const secret = 'sk-secretvalue1234567890';
    const content = `OPENAI_API_KEY=${secret}`;
    const result = redactContent(content, [findingFor(content, secret)]);
    expect(result.content).toBe('OPENAI_API_KEY=<REDACTED>');
    expect(result.redactions).toBe(1);
    expect(result.content).not.toContain(secret);
  });

  it('redacts multiple findings in one document', () => {
    const a = 'sk-aaaaaaaaaaaaaaaaaaaa';
    const b = 'ghp_bbbbbbbbbbbbbbbbbbbb';
    const content = `KEY=${a}\nTOKEN=${b}\n`;
    const result = redactContent(content, [findingFor(content, a), findingFor(content, b)]);
    expect(result.content).toBe('KEY=<REDACTED>\nTOKEN=<REDACTED>\n');
    expect(result.redactions).toBe(2);
  });

  it('sorts findings by position regardless of input order', () => {
    const a = 'aaaaaaaa';
    const b = 'bbbbbbbb';
    const content = `${a} ${b}`;
    const result = redactContent(content, [findingFor(content, b), findingFor(content, a)]);
    expect(result.content).toBe('<REDACTED> <REDACTED>');
  });

  it('collapses overlapping findings', () => {
    const content = 'password=supersecretvalue';
    const outer = findingFor(content, 'supersecretvalue');
    const inner: Finding = { ...outer, index: (outer.index ?? 0) + 5, length: 6 };
    const result = redactContent(content, [outer, inner]);
    expect(result.redactions).toBe(1);
    expect(result.content).toBe('password=<REDACTED>');
  });

  it('never leaks the tail of a partially overlapping finding', () => {
    // Span A covers [4, 14); span B starts inside A but extends past its end.
    // The tail of B must not survive into the output.
    const content = 'KEY=aaaaabbbbbccccc rest';
    const a = findingFor(content, 'aaaaabbbbb');
    const b: Finding = { ...a, index: 9, length: 10 }; // 'bbbbbccccc'
    const result = redactContent(content, [a, b]);
    expect(result.content).not.toContain('ccccc');
    expect(result.content).toBe('KEY=<REDACTED> rest');
  });

  it('reveals a preview when preservePreview is set (but never the full value)', () => {
    const secret = 'sk-abcdefghijklmnopqrstuvwxyz';
    const content = `KEY=${secret}`;
    const result = redactContent(content, [findingFor(content, secret)], { preservePreview: true });
    expect(result.content.startsWith('KEY=sk-')).toBe(true);
    expect(result.content).not.toContain(secret);
  });

  it('supports a custom per-finding token', () => {
    const secret = 'sk-xyz1234567890abcdef';
    const content = `KEY=${secret}`;
    const result = redactContent(content, [findingFor(content, secret)], {
      tokenFor: (f) => `[${f.category}]`,
    });
    expect(result.content).toBe('KEY=[api-key]');
  });

  it('supports a custom flat token', () => {
    const secret = 'sk-token1234567890abcd';
    const content = `KEY=${secret}`;
    const result = redactContent(content, [findingFor(content, secret)], { token: '***' });
    expect(result.content).toBe('KEY=***');
  });

  it('ignores file-level findings (no index)', () => {
    const content = 'nothing to redact here';
    const fileFinding: Finding = {
      detectorId: 'filename:dotenv',
      detectorKind: 'filename',
      title: '.env',
      category: 'sensitive-file',
      severity: 'high',
      confidence: 'high',
      length: 0,
      redactedPreview: '<REDACTED>',
      fingerprint: 'fp',
    };
    const result = redactContent(content, [fileFinding]);
    expect(result.content).toBe(content);
    expect(result.redactions).toBe(0);
  });

  it('leaves content untouched when there are no findings', () => {
    expect(redactContent('hello', []).content).toBe('hello');
  });
});

describe('redactValue', () => {
  it('returns the flat token by default', () => {
    expect(redactValue('sk-secret')).toBe('<REDACTED>');
  });

  it('reveals a preview when asked', () => {
    expect(redactValue('sk-abcdefghijklmnop', { preview: true })).toMatch(/^sk-/);
  });

  it('masks with options when provided', () => {
    const masked = redactValue('abcdefghijkl', { mask: { revealStart: 2 } });
    expect(masked).toMatch(/^ab\*+/);
    expect(masked).not.toBe('abcdefghijkl');
  });
});

describe('Redactor', () => {
  it('applies its configured options', () => {
    const secret = 'sk-configured1234567890';
    const content = `KEY=${secret}`;
    const redactor = new Redactor({ token: '<HIDDEN>' });
    expect(redactor.redact(content, [findingFor(content, secret)]).content).toBe('KEY=<HIDDEN>');
  });
});

describe('redactEnvContent', () => {
  it('masks every value while keeping keys, comments, and blank lines', () => {
    const content = [
      '# app settings',
      'APP_NAME=my-app',
      'export DB_PASSWORD=hunter2',
      '',
      'PORT=3000',
    ].join('\n');
    const result = redactEnvContent(content);
    expect(result.content).toBe(
      [
        '# app settings',
        'APP_NAME=<REDACTED>',
        'export DB_PASSWORD=<REDACTED>',
        '',
        'PORT=<REDACTED>',
      ].join('\n'),
    );
    expect(result.redactions).toBe(3);
    expect(result.content).not.toContain('hunter2');
  });

  it('handles CRLF line endings and yaml-style colons', () => {
    const result = redactEnvContent('token: abc123\r\nname: demo\r\n');
    expect(result.content).toBe('token: <REDACTED>\r\nname: <REDACTED>\r\n');
  });

  it('leaves keys with empty values and non-assignment lines alone', () => {
    const content = 'EMPTY=\nsome random prose line\nKEY=value';
    const result = redactEnvContent(content);
    expect(result.content).toBe('EMPTY=\nsome random prose line\nKEY=<REDACTED>');
    expect(result.redactions).toBe(1);
  });

  it('honours a custom token', () => {
    expect(redactEnvContent('A=b12345', { token: '***' }).content).toBe('A=***');
  });
});
