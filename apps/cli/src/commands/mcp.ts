import { join } from 'node:path';
import { Guardrails } from '@guardrails/core';
import { JsonlAuditSink } from '@guardrails/audit';
import {
  McpServer,
  Mediator,
  PROTOCOL_VERSION,
  diskFileSource,
  serveStdio,
} from '@guardrails/mcp-server';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';
import { CONFIG_DIR } from '../config.js';

export const AUDIT_FILE = 'audit.jsonl';

export interface McpServeOptions {
  readonly root?: string;
  readonly allow?: readonly string[];
  readonly deny?: readonly string[];
  readonly tool?: string;
  readonly noAudit?: boolean;
}

/**
 * `guardrails mcp serve [root]` - run the MCP server on stdio. stdout is the
 * JSON-RPC channel, so all human-facing output goes to stderr.
 */
export async function runMcpServe(options: McpServeOptions, io: IO): Promise<number> {
  const root = options.root ?? process.cwd();
  const auditPath = join(process.cwd(), CONFIG_DIR, AUDIT_FILE);

  const mediator = new Mediator({
    guardrails: new Guardrails(),
    ...(options.noAudit === true ? {} : { audit: new JsonlAuditSink(auditPath) }),
    ...(options.allow !== undefined ? { allow: [...options.allow] } : {}),
    ...(options.deny !== undefined ? { deny: [...options.deny] } : {}),
  });

  const server = new McpServer({
    mediator,
    source: diskFileSource(root),
    ...(options.tool !== undefined ? { tool: options.tool } : {}),
  });

  io.err(`${icon.shield} Guardrails MCP server on stdio - serving ${root}`);
  io.err(
    c.dim(`Protocol ${PROTOCOL_VERSION}. Audit: ${options.noAudit === true ? 'off' : auditPath}`),
  );
  await serveStdio(server);
  return 0;
}

/** `guardrails mcp info` - describe the server without starting it. */
export function runMcpInfo(io: IO): number {
  io.out(heading('Guardrails MCP server'));
  io.out('');
  io.out(`  ${icon.bullet} Protocol version: ${c.cyan(PROTOCOL_VERSION)}`);
  io.out(`  ${icon.bullet} Transport:        ${c.cyan('stdio (newline-delimited JSON-RPC)')}`);
  io.out(`  ${icon.bullet} Tools exposed:    ${c.cyan('read_file, list_files')}`);
  io.out('');
  io.out(c.dim('Every file is mediated by Guardrails; denied files are never returned.'));
  io.out(c.dim('Start it with `guardrails mcp serve` and point your AI client at it.'));
  return 0;
}
