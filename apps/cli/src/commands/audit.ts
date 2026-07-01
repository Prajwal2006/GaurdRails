import { join } from 'node:path';
import { JsonlAuditSink } from '@guardrails/audit';
import type { IO } from '../io.js';
import { c, heading, icon } from '../ui.js';
import { CONFIG_DIR } from '../config.js';
import { AUDIT_FILE } from './mcp.js';

export interface AuditCommandOptions {
  readonly limit?: number;
  readonly json?: boolean;
  readonly file?: string;
}

/** `guardrails audit` - show the value-free audit log. */
export function runAudit(options: AuditCommandOptions, io: IO): number {
  const path = options.file ?? join(process.cwd(), CONFIG_DIR, AUDIT_FILE);
  const sink = new JsonlAuditSink(path);
  const events = options.limit === undefined ? sink.list() : sink.list(options.limit);

  if (options.json === true) {
    io.out(JSON.stringify(events, null, 2));
    return 0;
  }

  io.out(heading('Audit log'));
  io.out('');
  if (events.length === 0) {
    io.out(`  ${icon.info} No audit events recorded yet (${c.gray(path)}).`);
    return 0;
  }
  for (const event of events) {
    const when = c.gray(event.timestamp);
    const tool = event.tool === undefined ? '' : c.cyan(`[${event.tool}] `);
    const where = event.path === undefined ? '' : ` ${event.path}`;
    io.out(`  ${when} ${tool}${c.bold(event.action)}${where}`);
    io.out(`      ${c.dim(event.reason)}`);
  }
  io.out('');
  io.out(c.dim(`${events.length} event(s) from ${path}`));
  return 0;
}
