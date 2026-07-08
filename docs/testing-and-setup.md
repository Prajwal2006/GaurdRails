# Guardrails - Setup & Testing Guide

This guide covers how to set up the Guardrails monorepo, build it, and test
every feature - with special focus on the **Phase 6 (Git protection)** and
**Phase 7 (MCP server & agent adapters)** work.

Guardrails is **local-only and privacy-first**: it never transmits your code or
secrets anywhere. Every check runs on your machine.

---

## 1. Prerequisites

| Tool    | Version    | Why                                         |
| ------- | ---------- | ------------------------------------------- |
| Node.js | **>= 20**  | Runtime (uses native ESM, top-level await)  |
| pnpm    | **10.x**   | Workspace/monorepo package manager          |
| git     | any recent | Required for Phase 6 features and its tests |

Check what you have:

```bash
node --version   # v20+ expected
pnpm --version   # 10.x expected
git --version
```

> No pnpm yet? `npm install -g pnpm@10` (or `corepack enable`).

---

## 2. First-time setup

From the repository root (`GaurdRails/`):

```bash
pnpm install
```

This links all workspace packages together (`@guardrails/*`) and installs dev
tooling. You should see “11 workspace projects”.

### Workspace layout

```
packages/
  shared/          # types & contracts (no runtime deps)
  secret-detector/ # detection engine
  redaction/       # structure-preserving redaction
  policy-engine/   # allow/deny/redact/audit decisions
  audit/           # NEW  - audit sinks (memory + JSONL)
  core/            # orchestration facade + fs scanning
  adapters/        # NEW  - AI tool adapters + registry
  git/             # NEW  - git scanning + hooks + fixes
  mcp-server/      # NEW  - mediator + MCP JSON-RPC server + stdio
apps/
  cli/             # the `guardrails` command-line tool
```

---

## 3. Build, typecheck, lint, test

All commands run from the repo root.

```bash
pnpm run build         # tsc -b (emits dist/ for every package)
pnpm run typecheck     # tsc -b (type-only, no manual emit needed)
pnpm run lint          # eslint (type-checked rules)
pnpm run test          # vitest run - the whole suite
pnpm run test:coverage # vitest with coverage thresholds
pnpm run check         # format:check + lint + typecheck + test (CI gate)
```

Tests run directly against **TypeScript source** (via Vitest aliases), so you do
**not** need to build before testing.

### Expected results

- **368+ tests pass**, 41 test files.
- Coverage for the new packages is ~99% lines (thresholds: 85% lines/functions/
  statements, 80% branches).

> **Windows note (line endings):** `pnpm run format:check` may flag _every_ file
> if your git checkout used CRLF line endings (Prettier is configured for LF and
> the repo has no `.gitattributes`). This is a checkout artifact, not a code
> problem. Fix it once with `pnpm run format` (rewrites to LF) or configure git
> with `git config core.autocrlf input` and re-checkout. Build, typecheck, lint,
> and tests are unaffected.

### Run a focused subset

```bash
# One package
pnpm vitest run packages/git
pnpm vitest run packages/mcp-server

# One file
pnpm vitest run packages/git/src/hooks.test.ts

# Watch mode while developing
pnpm vitest packages/adapters
```

---

## 4. Testing Phase 6 - Git protection

The `@guardrails/git` package scans staged/tracked files, installs reversible
git hooks, and generates educational messages + auto-fixes.

### 4.1 Automated tests

```bash
pnpm vitest run packages/git
pnpm vitest run apps/cli/src/git-cli.test.ts
```

What they cover:

- **`git.test.ts`** - the git wrapper with a fake runner (no real git needed)
  plus a **real-git integration test** that inits a temp repo, stages a file,
  and reads it back.
- **`hooks.test.ts`** - install is **idempotent** (second run = `unchanged`),
  appending to a pre-existing hook **preserves** it, and uninstall is
  **reversible** (removes only the Guardrails block).
- **`scanner.test.ts`** - staged/tracked scanning, binary + oversized skip.
- **`autofix.test.ts`** - `.gitignore` pattern derivation, `.env.example`
  builder (keys kept, values stripped), on-disk `applyFixes`.
- **`messages.test.ts`** - block messages **never leak** the secret value.

### 4.2 Manual end-to-end test (real repo)

Create a throwaway repo and try it against the built CLI:

```bash
# 1. Build once so `node apps/cli/dist/main.cjs` works
pnpm run build

# 2. Make a scratch repo
mkdir /tmp/gr-demo && cd /tmp/gr-demo   # Windows: use a temp folder
git init

# 3. Add a fake secret + a clean file
echo "OPENAI_API_KEY=sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" > .env
echo "export const x = 1;" > index.ts
git add .

# 4. Point the CLI at the repo (adjust the path back to this monorepo)
GR="node /path/to/GaurdRails/apps/cli/dist/main.cjs"

$GR git scan          # lists the staged secret, exit code 1, value redacted
$GR git install       # installs pre-commit + pre-push hooks
$GR git status        # shows both hooks as "installed"
git commit -m "test"  # BLOCKED: educational message, commit aborted
$GR git fix           # creates .gitignore + .env.example (safe, reversible)
$GR git uninstall     # removes only the Guardrails hook block
```

Key things to verify:

- `git commit` is **blocked** with a friendly explanation and **no raw secret**
  in the output.
- `--no-verify` bypasses the hook (git’s built-in escape hatch).
- After `git fix`, `.env.example` contains `OPENAI_API_KEY=` (no value) and
  `.gitignore` contains `.env`.

### 4.3 CLI reference (git)

| Command                     | What it does                                          |
| --------------------------- | ----------------------------------------------------- |
| `guardrails git install`    | Install pre-commit + pre-push hooks (idempotent)      |
| `guardrails git uninstall`  | Remove Guardrails hooks, preserving any other content |
| `guardrails git status`     | Show hook installation status                         |
| `guardrails git scan`       | Scan the staged changeset (`--json` supported)        |
| `guardrails git check`      | Scan every tracked file (`--json` supported)          |
| `guardrails git fix`        | Apply `.gitignore` + `.env.example` fixes             |
| `guardrails git pre-commit` | Hook entry point (blocks commit on secrets)           |
| `guardrails git pre-push`   | Hook entry point (blocks push on secrets)             |

Exit codes: `0` clean · `1` secrets found / commit blocked · `2` not a git repo.

---

## 5. Testing Phase 7 - MCP server & agent adapters

Three packages work together:

- **`@guardrails/adapters`** - translate each AI tool’s request/response shape.
- **`@guardrails/audit`** - persist value-free audit events.
- **`@guardrails/mcp-server`** - the `Mediator` (the security decision) plus an
  MCP JSON-RPC server exposing only approved files.

### 5.1 Automated tests

```bash
pnpm vitest run packages/adapters
pnpm vitest run packages/audit
pnpm vitest run packages/mcp-server
pnpm vitest run apps/cli/src/extra-cli.test.ts
```

Highlights:

- **`mediator.test.ts`** - a denied sensitive file is served as a **fully
  redacted copy** by default (every `KEY=value` masked, audit records
  `redact`); `denyMode: 'withhold'` returns nothing instead (audit records
  `deny`); deny/allow lists are honored; medium secrets are **redacted**; clean
  content passes through untouched; works with **no audit sink**.
- **`server.test.ts`** - full protocol: `initialize`, `tools/list`,
  `tools/call` for `read_file` and `list_files`; a file with a secret is
  redacted (or withheld in strict mode) and the raw value is **never leaked**;
  `list_files` marks redacted files.
- **`file-source.test.ts`** - path-traversal is refused (`../../etc/passwd`
  → undefined), ignored dirs skipped.
- **`stdio.test.ts`** - newline-delimited JSON-RPC over a stream, parse errors
  handled, notifications stay silent.
- **`audit/*`** - JSONL sink round-trips, tolerates corrupt lines, honors limit.

### 5.2 Manual end-to-end test (MCP over stdio)

The server speaks JSON-RPC 2.0 over stdio (one JSON message per line). You can
drive it by piping messages in:

```bash
pnpm run build

printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node apps/cli/dist/main.cjs mcp serve --no-audit
```

You should get two JSON-RPC responses: server info (protocol `2024-11-05`) and
the two tools (`read_file`, `list_files`).

Try a mediated read of a secret file (it is served as a redacted copy):

```bash
echo "OPENAI_API_KEY=sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" > secret.env
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"secret.env"}}}' \
  | node apps/cli/dist/main.cjs mcp serve --no-audit
# → content is "OPENAI_API_KEY=<REDACTED>" + a plain-English note.
#   The response contains NO raw key. Add --withhold for a hard block instead.
```

**Serve options**

```
guardrails mcp serve [root]
  --allow <globs...>   always allow (e.g. --allow "src/**")
  --deny  <globs...>   always deny outright (e.g. --deny "**/*.pem")
  --tool  <id>         attribute requests to a tool id (default claude-code)
  --withhold           strict mode: return nothing for denied files
                       (default: return a fully redacted copy)
  --no-audit           do not write an audit log
```

By default an audit trail is written to `.guardrails/audit.jsonl` (value-free).

### 5.3 Inspect adapters and the audit log

```bash
guardrails adapters          # list the 6 supported AI tools
guardrails mcp info          # describe the server without starting it
guardrails audit             # show recent audit events
guardrails audit --limit 20 --json
guardrails audit --file .guardrails/audit.jsonl
```

### 5.4 Wiring the server into an AI client (example: Claude Desktop)

The easy way: run `guardrails connect <tool>` inside the project - it prints
this config with your machine's absolute paths already filled in, for Claude
Code, Claude Desktop, Cursor, Windsurf, Antigravity, Gemini CLI, Codex, and
GitHub Copilot.

Manually: MCP clients launch the server as a subprocess and talk over stdio.
Add an entry to your client’s MCP config pointing at the built binary:

```json
{
  "mcpServers": {
    "guardrails": {
      "command": "node",
      "args": ["/absolute/path/to/GaurdRails/apps/cli/dist/main.cjs", "mcp", "serve", "."],
      "env": { "NO_COLOR": "1" }
    }
  }
}
```

Once connected, the client sees only `read_file` and `list_files`, and every
file it requests is mediated by Guardrails - secrets are redacted or withheld,
and each decision is audited.

---

## 6. How the pieces fit (security model)

```
AI tool ──▶ adapter.normalizeRequest ──▶ FileReadRequest
                                             │
                                             ▼
                                        Mediator.mediate
                          deny-list? ── yes ─▶ withhold  (audit: deny)
                          allow-list? ─ yes ─▶ expose    (explicit trust)
                                             │ no
                                             ▼
                                    Guardrails.inspect (detect + policy)
                     deny ─▶ fully redacted copy (audit: redact)
                             (or withhold, with denyMode: 'withhold')
                     redact ─▶ mask (audit)
                     audit-only ─▶ expose (audit)  clean ─▶ expose
                                             │
                                             ▼
                             adapter.formatResponse ──▶ AI tool
```

Guarantees enforced (and tested):

- A raw secret value is **never** returned to a tool that is denied/redacted.
- Audit events contain only **value-free** summaries (category/severity/line).
- The MCP file source refuses reads **outside the served root**.

---

## 7. Troubleshooting

| Symptom                                      | Fix                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `format:check` flags every file (Windows)    | CRLF checkout - run `pnpm run format` or `git config core.autocrlf input`.       |
| `git` tests skip / “not a git repository”    | Install git and ensure it’s on `PATH` (`git --version`).                         |
| `mcp serve` seems to hang                    | Expected - it reads stdin until closed. Pipe input or Ctrl-D/Ctrl-C.             |
| MCP client shows nothing                     | Use an **absolute** path to `apps/cli/dist/main.cjs` and `pnpm run build` first. |
| Coverage threshold failure after adding code | Add tests, or run `pnpm run test:coverage` to see uncovered lines.               |

---

## 8. Quick reference - full local verification

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:coverage
```

Everything green (aside from the Windows CRLF note on `format:check`) means the
Phase 6 and Phase 7 features are working as designed.
