import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GuardedFileServer, MemoryAuditSink, DENY_MESSAGE } from './server.js';

const OPENAI = 'sk-' + 'a'.repeat(40);
let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'guardrails-mcp-'));
  await writeFile(join(root, 'clean.ts'), 'export const x = 1;\n');
  await writeFile(join(root, 'other.ts'), 'export const y = 2;\n');
  await writeFile(join(root, '.env'), `OPENAI_API_KEY=${OPENAI}\n`);
  await writeFile(join(root, 'pwd.txt'), 'DB_PASSWORD=SuperSecretValue123\n');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('GuardedFileServer.read', () => {
  it('serves clean files', async () => {
    const result = await new GuardedFileServer({ root }).read('clean.ts');
    expect(result.status).toBe('allowed');
    expect(result.content).toContain('const x');
  });

  it('denies sensitive files with a clear message and no content', async () => {
    const result = await new GuardedFileServer({ root }).read('.env');
    expect(result.status).toBe('denied');
    expect(result.message).toBe(DENY_MESSAGE);
    expect(result.content).toBeUndefined();
  });

  it('redacts medium-severity findings, never leaking the value', async () => {
    const result = await new GuardedFileServer({ root }).read('pwd.txt');
    expect(result.status).toBe('redacted');
    expect(result.content).toContain('<REDACTED>');
    expect(result.content).not.toContain('SuperSecretValue123');
  });

  it('blocks path traversal outside the root', async () => {
    const result = await new GuardedFileServer({ root }).read('../secret.txt');
    expect(result.status).toBe('denied');
  });

  it('honours a deny list', async () => {
    const result = await new GuardedFileServer({ root, deny: ['**/*.ts'] }).read('clean.ts');
    expect(result.status).toBe('denied');
  });

  it('honours an allow list', async () => {
    const server = new GuardedFileServer({ root, allow: ['clean.ts'] });
    expect((await server.read('clean.ts')).status).toBe('allowed');
    expect((await server.read('other.ts')).status).toBe('denied');
  });

  it('reports read errors for missing files', async () => {
    const result = await new GuardedFileServer({ root }).read('does-not-exist.ts');
    expect(result.status).toBe('error');
  });
});

describe('audit logging', () => {
  it('records decisions without ever storing a secret', async () => {
    const audit = new MemoryAuditSink();
    const server = new GuardedFileServer({ root, audit });
    await server.read('.env');
    await server.read('pwd.txt');
    const events = audit.list();
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(events)).not.toContain(OPENAI);
    expect(JSON.stringify(events)).not.toContain('SuperSecretValue123');
    expect(events[0]?.tool).toBe('mcp');
  });
});
