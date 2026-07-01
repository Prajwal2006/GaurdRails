import type { Detector } from '@guardrails/shared';
import { makeRegexDetector, type RegexRule } from './factory.js';

/** Decode a base64url segment to a UTF-8 string. */
function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

/** True when a `a.b.c` string has a decodable JWT header containing `alg`. */
export function isJwt(value: string): boolean {
  const parts = value.split('.');
  if (parts.length < 2) return false;
  const headerRaw = parts[0];
  if (headerRaw === undefined || headerRaw.length === 0) return false;
  try {
    const header = JSON.parse(base64UrlDecode(headerRaw)) as unknown;
    return typeof header === 'object' && header !== null && 'alg' in header;
  } catch {
    return false;
  }
}

/** Matches a full PEM private-key block (RSA, EC, OPENSSH, PGP, encrypted…). */
export const privateKeyDetector: Detector = makeRegexDetector({
  id: 'private-key',
  title: 'Private key',
  category: 'private-key',
  severity: 'critical',
  confidence: 'high',
  kind: 'structural',
  boundary: false,
  pattern:
    /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY(?: BLOCK)?-----/,
  explanationId: 'private-key',
  description: 'Detects PEM-encoded private keys of any type.',
});

/** Matches a JWT and validates its header decodes to JSON with an `alg` field. */
export const jwtDetector: Detector = makeRegexDetector({
  id: 'jwt',
  title: 'JSON Web Token (JWT)',
  category: 'jwt',
  severity: 'high',
  confidence: 'high',
  kind: 'structural',
  pattern: /eyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/,
  explanationId: 'jwt',
  validate: isJwt,
  description: 'Detects JSON Web Tokens with a valid, decodable header.',
});

/** Matches a URI that embeds credentials, e.g. `postgres://user:pass@host/db`. */
export const connectionStringDetector: Detector = makeRegexDetector({
  id: 'connection-string',
  title: 'Connection string with embedded credentials',
  category: 'connection-string',
  severity: 'high',
  confidence: 'high',
  kind: 'structural',
  boundary: false,
  pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^:@\s/]*:[^@\s/]+@[^\s"'<>`)\]}]+/i,
  explanationId: 'connection-string',
  description: 'Detects database and broker URIs that carry a username:password.',
});

const rule: RegexRule = {
  id: 'basic-auth-header',
  title: 'HTTP Basic auth credentials',
  category: 'password',
  severity: 'medium',
  confidence: 'medium',
  boundary: false,
  pattern: /\bBasic\s+([A-Za-z0-9+/]{16,}={0,2})/,
  group: 1,
  explanationId: 'basic-auth',
};

/** Matches a base64-encoded HTTP Basic authorization header value. */
export const basicAuthDetector: Detector = makeRegexDetector(rule);

export const structuralDetectors: readonly Detector[] = [
  privateKeyDetector,
  jwtDetector,
  connectionStringDetector,
  basicAuthDetector,
];
