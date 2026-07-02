import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { McpServer } from './server.js';
import { Mediator } from './mediator.js';
import { serveStdio } from './stdio.js';
import type { FileSource } from './file-source.js';

const source: FileSource = {
  list: () => Promise.resolve(['a.ts']),
  read: (path) => Promise.resolve(path === 'a.ts' ? 'export const x = 1;\n' : undefined),
};

function collect(stream: PassThrough): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    stream.on('data', (chunk: Buffer) => (data += chunk.toString('utf8')));
    stream.on('end', () => resolve(data));
  });
}

describe('serveStdio', () => {
  it('reads newline-delimited requests and writes responses', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const server = new McpServer({ mediator: new Mediator(), source });

    const done = serveStdio(server, { input, output });
    const collected = collect(output);

    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })}\n`);
    input.write('\n'); // blank line is ignored
    input.write('not json\n'); // parse error → error response
    input.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    input.end();

    await done;
    output.end();
    const text = await collected;
    const lines = text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as Record<string, unknown>);

    // One response for ping, one for the parse error; the notification is silent.
    // Responses may arrive in either order (handling is async), so match by shape.
    expect(lines).toHaveLength(2);
    const ping = lines.find((l) => l.id === 1);
    const parseError = lines.find((l) => l.error !== undefined);
    expect(ping).toMatchObject({ id: 1, result: {} });
    expect((parseError as { error: { message: string } }).error.message).toContain('Parse error');
  });
});
