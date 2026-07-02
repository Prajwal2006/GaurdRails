import { createInterface } from 'node:readline';
import type { GuardedFileServer } from './server.js';
import { handleMessage } from './protocol.js';

export interface StdioOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

/**
 * Run the guarded file server over newline-delimited JSON-RPC on stdio (the MCP
 * stdio transport). Resolves when the input stream closes.
 */
export function startStdioServer(
  server: GuardedFileServer,
  options: StdioOptions = {},
): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const rl = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });

  return new Promise<void>((resolvePromise) => {
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return;
      void (async () => {
        let message: unknown;
        try {
          message = JSON.parse(trimmed);
        } catch {
          output.write(
            `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`,
          );
          return;
        }
        const response = await handleMessage(server, message);
        if (response !== undefined) output.write(`${JSON.stringify(response)}\n`);
      })();
    });
    rl.on('close', () => resolvePromise());
  });
}
