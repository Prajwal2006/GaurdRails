import { describe, expect, it } from 'vitest';
import { createDetectionContext } from '@guardrails/shared';
import type { Detector, Finding } from '@guardrails/shared';
import {
  basicAuthDetector,
  connectionStringDetector,
  isJwt,
  jwtDetector,
  privateKeyDetector,
} from './structural.js';

function scan(detector: Detector, content: string): Finding[] {
  return detector.detect(createDetectionContext({ content }));
}

describe('privateKeyDetector', () => {
  it('detects a PEM private-key block', () => {
    const content = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEpAIBAAKCAQEA' + 'a'.repeat(40),
      'b'.repeat(60),
      '-----END RSA PRIVATE KEY-----',
    ].join('\n');
    const [finding] = scan(privateKeyDetector, content);
    expect(finding?.category).toBe('private-key');
    expect(finding?.severity).toBe('critical');
    expect(finding?.detectorKind).toBe('structural');
  });

  it('detects OPENSSH private keys too', () => {
    const content = '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----';
    expect(scan(privateKeyDetector, content)).toHaveLength(1);
  });

  it('does not match a public key', () => {
    const content = 'ssh-rsa AAAAB3NzaC1yc2E user@host';
    expect(scan(privateKeyDetector, content)).toHaveLength(0);
  });
});

describe('jwtDetector / isJwt', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: '123', name: 'x' })).toString('base64url');
  const token = `${header}.${payload}.` + 'a'.repeat(24);

  it('detects a well-formed JWT', () => {
    const [finding] = scan(jwtDetector, `token = ${token}`);
    expect(finding?.category).toBe('jwt');
  });

  it('isJwt validates the header', () => {
    expect(isJwt(token)).toBe(true);
    expect(isJwt('not.a.jwt')).toBe(false);
    expect(isJwt('eyJ')).toBe(false);
  });

  it('ignores an eyJ-looking string whose header has no alg', () => {
    const noAlg = Buffer.from(JSON.stringify({ typ: 'JWT' })).toString('base64url');
    const fake = `${noAlg}.${payload}.` + 'a'.repeat(24);
    expect(scan(jwtDetector, fake)).toHaveLength(0);
  });
});

describe('connectionStringDetector', () => {
  it('detects a Postgres URL with credentials', () => {
    const [finding] = scan(
      connectionStringDetector,
      'postgres://admin:s3cr3t@db.example.com:5432/app',
    );
    expect(finding?.category).toBe('connection-string');
    expect(finding?.severity).toBe('high');
  });

  it('detects a Redis URL with an empty username', () => {
    expect(scan(connectionStringDetector, 'redis://:mypassword@localhost:6379')).toHaveLength(1);
  });

  it('does not flag a URL without credentials', () => {
    expect(scan(connectionStringDetector, 'https://example.com/path?q=1')).toHaveLength(0);
  });

  it('never leaks the embedded password', () => {
    const found = scan(connectionStringDetector, 'mysql://root:superSecretPw@127.0.0.1/db');
    expect(JSON.stringify(found)).not.toContain('superSecretPw');
  });
});

describe('basicAuthDetector', () => {
  it('detects a base64 Basic auth header', () => {
    const [finding] = scan(basicAuthDetector, 'Authorization: Basic YWxhZGRpbjpvcGVuc2VzYW1l');
    expect(finding?.category).toBe('password');
  });
});
