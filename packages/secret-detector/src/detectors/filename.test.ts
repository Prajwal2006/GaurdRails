import { describe, expect, it } from 'vitest';
import { createDetectionContext } from '@guardrails/shared';
import { filenameDetector, isExampleFile } from './filename.js';

function scan(path: string | undefined): string[] {
  const ctx = createDetectionContext(path === undefined ? { content: '' } : { path, content: '' });
  return filenameDetector.detect(ctx).map((f) => f.detectorId);
}

describe('filenameDetector', () => {
  const positives: ReadonlyArray<[string, string]> = [
    ['.env', 'filename:dotenv'],
    ['.env.production', 'filename:dotenv'],
    ['project/.env.local', 'filename:dotenv'],
    ['id_rsa', 'filename:ssh-key'],
    ['home/.ssh/my_deploy_key', 'filename:ssh-key'],
    ['server.pem', 'filename:key-file'],
    ['private.key', 'filename:key-file'],
    ['cert.p12', 'filename:key-file'],
    ['home/.aws/credentials', 'filename:aws-credentials'],
    ['service-account.json', 'filename:service-account'],
    ['firebase-adminsdk-abc123.json', 'filename:service-account'],
    ['kubeconfig', 'filename:kubeconfig'],
    ['home/.kube/config', 'filename:kubeconfig'],
    ['terraform.tfvars', 'filename:tfvars'],
    ['secrets.yaml', 'filename:secrets-file'],
    ['.npmrc', 'filename:npmrc'],
    ['.netrc', 'filename:netrc'],
    ['.htpasswd', 'filename:htpasswd'],
  ];

  for (const [path, id] of positives) {
    it(`flags ${path}`, () => {
      expect(scan(path)).toContain(id);
    });
  }

  const negatives: readonly string[] = [
    '.env.example',
    '.env.sample',
    'config.example.json',
    'id_rsa.pub',
    'home/.ssh/known_hosts',
    'home/.ssh/config',
    'src/index.ts',
    'README.md',
    'package.json',
  ];

  for (const path of negatives) {
    it(`does not flag ${path}`, () => {
      expect(scan(path)).toHaveLength(0);
    });
  }

  it('returns nothing when there is no path', () => {
    expect(scan(undefined)).toHaveLength(0);
  });

  it('returns at most one finding per file', () => {
    // `secret.pem` could match multiple heuristics; ensure it yields exactly one.
    expect(scan('config/secret.pem')).toHaveLength(1);
  });
});

describe('isExampleFile', () => {
  it('recognises example/sample/template files', () => {
    expect(isExampleFile('.env.example')).toBe(true);
    expect(isExampleFile('config.sample.json')).toBe(true);
    expect(isExampleFile('docker-compose.template.yml')).toBe(true);
    expect(isExampleFile('.env')).toBe(false);
    expect(isExampleFile('credentials.json')).toBe(false);
  });
});
