import { describe, expect, it } from 'vitest';
import { createDetectionContext } from '@guardrails/shared';
import type { Finding } from '@guardrails/shared';
import { keywordAssignmentDetector } from './keyword-assignment.js';

function scan(content: string): Finding[] {
  return keywordAssignmentDetector.detect(createDetectionContext({ content }));
}

describe('keywordAssignmentDetector', () => {
  it('flags a hard-coded database password', () => {
    const [finding] = scan('DB_PASSWORD=SuperSecretValue123');
    expect(finding?.category).toBe('password');
    expect(finding?.title).toBe('Hard-coded password');
  });

  it('flags a quoted API token as a generic secret', () => {
    const [finding] = scan('API_TOKEN: "abcdefghijklmnop123"');
    expect(finding?.category).toBe('generic-secret');
  });

  it('flags a single-quoted client secret', () => {
    expect(scan("client_secret = 'myClientSecretValue'")).toHaveLength(1);
  });

  const placeholders: readonly string[] = [
    'PASSWORD=changeme',
    'API_KEY=your-api-key',
    'SECRET=process.env.SECRET',
    'TOKEN=${MY_TOKEN}',
    'PASSWORD=xxxxxx',
    'DB_PASSWORD=<your-password>',
    'PASSWORD=null',
  ];

  for (const line of placeholders) {
    it(`ignores placeholder: ${line}`, () => {
      expect(scan(line)).toHaveLength(0);
    });
  }

  it('ignores keys that do not imply a secret', () => {
    expect(scan('publicUrl=https://example.com/very/long/path')).toHaveLength(0);
    expect(scan('username=johndoe1234')).toHaveLength(0);
  });

  it('ignores values shorter than 6 characters', () => {
    expect(scan('password=ab12')).toHaveLength(0);
  });

  it('never leaks the raw value', () => {
    const found = scan('DB_PASSWORD=SuperSecretValue123');
    expect(JSON.stringify(found)).not.toContain('SuperSecretValue123');
  });
});
