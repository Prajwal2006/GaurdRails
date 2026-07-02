# MCP integration

Guardrails ships a **guarded MCP file server**. It speaks the Model Context
Protocol over stdio and exposes a single tool, `read_file`, that returns a file's
contents **only after** running them through Guardrails.

- **Clean files** are returned as-is.
- **Files with medium-risk findings** are returned **redacted** (`<REDACTED>`).
- **Sensitive files** (a `.env`, a private key, a high-severity secret) are
  **denied** with: _"Access denied. This file appears to contain sensitive
  information. Ask the user for permission if you genuinely need it."_
- **Path traversal** outside the served root is denied.

Everything runs locally; no data leaves your machine, and audit records never
contain a raw secret.

## Running

```bash
guardrails mcp serve                      # serve the current directory
guardrails mcp serve --root ./src
guardrails mcp serve --deny '**/*.env' '**/secrets/**'
guardrails mcp serve --allow 'src/**' 'README.md'
```

The server reads newline-delimited JSON-RPC 2.0 from stdin and writes responses
to stdout (the announcement banner goes to stderr so it never corrupts the
stream).

## Configuring an AI tool

Point your MCP-capable tool at the command. For example, a client config might
look like:

```json
{
  "mcpServers": {
    "guardrails": {
      "command": "guardrails",
      "args": ["mcp", "serve", "--root", "."]
    }
  }
}
```

## Using it as a library

```ts
import { GuardedFileServer, handleMessage } from '@guardrails/mcp';

const server = new GuardedFileServer({ root: process.cwd(), deny: ['**/*.env'] });
const result = await server.read('src/app.ts'); // { status: 'allowed', content }
```

## Adapters

`@guardrails/agent-adapters` normalises each AI tool's request/response shape to
Guardrails' neutral form. Supported out of the box: Claude Code, Codex, GitHub
Copilot, Gemini CLI, Cursor, and Windsurf. Run `guardrails agents` to list them.
Adding a new tool is a single `createAgentAdapter({ id, displayName })` call.
