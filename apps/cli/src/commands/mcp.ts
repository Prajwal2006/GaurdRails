import { resolve } from 'node:path';
import { GuardedFileServer, MemoryAuditSink, startStdioServer } from '@guardrails/mcp';
import { listAdapters } from '@guardrails/agent-adapters';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';

export interface McpServeOptions {
  readonly root?: string;
  readonly allow?: string[];
  readonly deny?: string[];
}

/**
 * `guardrails mcp serve` — run the guarded MCP file server on stdio. Blocks
 * until the input stream closes (i.e. the AI tool disconnects).
 */
export async function runMcpServe(io: IO, options: McpServeOptions): Promise<number> {
  const root = resolve(options.root ?? process.cwd());
  const server = new GuardedFileServer({
    root,
    audit: new MemoryAuditSink(),
    ...(options.allow ? { allow: options.allow } : {}),
    ...(options.deny ? { deny: options.deny } : {}),
  });
  // Announce on stderr so we don't corrupt the JSON-RPC stream on stdout.
  io.err(`${icon.shield} Guardrails MCP server serving ${c.cyan(root)} (local-only).`);
  await startStdioServer(server);
  return 0;
}

/** `guardrails agents` — list the AI tool adapters Guardrails understands. */
export function runAgents(io: IO): number {
  io.out(heading('Supported AI tools'));
  io.out('');
  for (const adapter of listAdapters()) {
    io.out(`  ${icon.bullet} ${c.bold(adapter.displayName)} ${c.gray(`(${adapter.id})`)}`);
  }
  io.out('');
  io.out(
    c.dim('New tools are a single adapter behind a shared interface — see docs/plugin-guide.md.'),
  );
  return 0;
}
