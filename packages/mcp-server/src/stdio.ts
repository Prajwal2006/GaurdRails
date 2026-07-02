import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { McpServer } from './server.js';
import { INVALID_REQUEST, failure } from './jsonrpc.js';

export interface StdioOptions {
  readonly input?: Readable;
  readonly output?: Writable;
}

/**
 * Serve an `McpServer` over newline-delimited JSON on stdio (the MCP stdio
 * transport). Resolves when the input stream closes. Each line is one JSON-RPC
 * message; responses are written back one per line.
 */
export function serveStdio(server: McpServer, options: StdioOptions = {}): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const rl = createInterface({ input, crlfDelay: Infinity });

  const write = (value: unknown): void => {
    output.write(`${JSON.stringify(value)}\n`);
  };

  return new Promise<void>((resolvePromise) => {
    rl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        write(failure(null, INVALID_REQUEST, 'Parse error: invalid JSON'));
        return;
      }
      void server.handle(parsed).then((response) => {
        if (response !== null) write(response);
      });
    });
    rl.on('close', () => {
      resolvePromise();
    });
  });
}
