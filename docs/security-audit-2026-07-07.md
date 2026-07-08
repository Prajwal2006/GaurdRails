# Security & bug audit — 2026-07-07

A full review of every source file in `packages/*` and `apps/*` for bugs and
security vulnerabilities. Each issue below states where it lived, why it
mattered, and how it was fixed. All fixes ship with regression tests; the full
suite (`pnpm test`) and `pnpm audit` are clean.

## Fixed issues

### 1. HIGH — Redaction could leak the tail of an overlapping secret

**Where:** `packages/redaction/src/redactor.ts` (`redactContent`)

**Problem:** Spans were processed in start order, and any span starting before
the cursor was skipped entirely. When a second finding _partially_ overlapped
the first (started inside it but ended after it), its uncovered tail was copied
verbatim into the "redacted" output. This violated the module's stated
invariant ("the returned content never contains the original value of any
redacted span"), and the output of this function is exactly what gets handed
to AI tools.

**Fix:** A skipped overlapping span now advances the cursor to its own end, so
the tail of an overlapping secret is swallowed instead of leaked. Regression
test: `never leaks the tail of a partially overlapping finding`.

### 2. HIGH — MCP file source followed symlinks out of the served root

**Where:** `packages/mcp-server/src/file-source.ts` (`diskFileSource.read`)

**Problem:** The path-traversal guard was purely lexical (`resolve` +
`relative`). `stat`/`readFile` follow symlinks, so a symlink _inside_ the
served root pointing at, say, `~/.ssh/id_rsa` or `/etc/passwd` passed the
containment check and was served. Content-based detectors would catch a PEM
key, but any file outside the root that doesn't look like a secret could be
exfiltrated through the `read_file` MCP tool.

**Fix:** `read()` now resolves both the root and the target with `realpath`
and re-checks containment on the resolved paths before reading. Symlinks that
stay inside the root keep working. Regression tests added for both directions.

### 3. MEDIUM — Pre-push scan read the git index, not the working tree

**Where:** `packages/git/src/git.ts` (`CliGitRepo.readWorkingContent`)

**Problem:** The method ran `git show :0:<path>`, which returns the **index**
(staged) content — the exact same thing `readStagedContent` (`git show
:<path>`) returns. So `scanTracked` (used by the pre-push hook, `guardrails
git check`, and `guardrails git fix`) never scanned what is actually on disk,
contrary to its contract ("the working-tree content of a path").

**Fix:** The method now reads the file from disk under the repository root.
Tests updated to verify disk content is returned.

### 4. MEDIUM — Hooks installed to the wrong directory when run from a subdirectory

**Where:** `packages/git/src/git.ts` (`CliGitRepo.hooksDir`)

**Problem:** `git rev-parse --git-path hooks` returns a path **relative to the
current working directory**, but the code resolved it against the repo _root_.
Running `guardrails git install` (or `setup`) from a subdirectory produced
e.g. `<root>/../.git/hooks` — hooks written or removed at the wrong location,
silently leaving the project unprotected.

**Fix:** Ask git directly for an absolute path with
`--path-format=absolute` (git ≥ 2.31), falling back to the old resolution for
older git versions. Covered by a new unit test.

### 5. MEDIUM — A rejected request handler crashed the MCP server process

**Where:** `packages/mcp-server/src/stdio.ts` (`serveStdio`)

**Problem:** `void server.handle(parsed).then(...)` had no rejection handler.
Any throw that escaped `handle` (e.g. from an injected `readContent` callback)
became an unhandled promise rejection, which terminates the Node process —
killing the security mediator mid-session.

**Fix:** Rejections are now caught and answered with a JSON-RPC
`-32603 Internal error` response instead of crashing the transport.

### 6. LOW — JSON-RPC 2.0 conformance errors in the MCP server

**Where:** `packages/mcp-server/src/{jsonrpc,stdio,server}.ts`

Three spec violations that can confuse strict MCP clients:

- Invalid JSON on stdin was answered with `-32600` (Invalid request) instead
  of `-32700` (Parse error).
- A structurally invalid request was answered with `-32601` (Method not
  found) instead of `-32600` (Invalid request).
- Requests whose `id` was not a string/number/null were accepted and the
  bogus id echoed back; they are now rejected as invalid.
- Notifications (no `id`) for known methods like `ping`/`tools/list` received
  responses; per JSON-RPC 2.0, notifications now never get a response.

### 7. HIGH — Vulnerable dev toolchain (vitest 2.x → vite/esbuild advisories)

**Where:** `package.json` / `pnpm-lock.yaml`

**Problem:** `pnpm audit` reported 5 known vulnerabilities (1 critical,
1 high, 3 moderate) in the test toolchain: vitest < 3.2.6, vite ≤ 6.4.2
(`server.fs.deny` bypass, path traversal in optimized-deps `.map` handling,
launch-editor NTLMv2 hash disclosure) and esbuild ≤ 0.24.2 (dev-server
request forgery). Dev-only exposure, but these run on contributor machines.

**Fix:** Upgraded `vitest` and `@vitest/coverage-v8` to ^3.2.6 and added pnpm
overrides forcing `vite >= 6.4.3` and `esbuild >= 0.25.0`.
`pnpm audit` now reports **no known vulnerabilities**.

### 8. LOW — `pnpm run check` failed on a clean checkout

**Where:** 13 files (docs, GitHub templates, a few sources)

**Problem:** Pre-existing Prettier drift made the documented quality gate
(`pnpm run check`) fail out of the box, training contributors to ignore it.

**Fix:** Ran `prettier --write` across the repository (formatting only, no
behavior change).

## Reviewed and intentionally left as-is

These were examined and judged acceptable, but are worth knowing about:

- **Git hooks fail open when the repo can't be opened.** `runGitHook` returns
  exit code 0 if `git` is unavailable — a deliberate "never brick the user's
  commit" choice, documented in the code. A stricter mode could be added later.
- **`mergeJsonFile` writes a one-time `<file>.guardrails-backup`.** Shared
  configs it edits (e.g. `claude_desktop_config.json`) may contain other MCP
  servers' credentials; the backup duplicates them next to the original with
  the same permissions. Same trust domain, so accepted — but users cleaning up
  secrets from a config should remember the backup.
- **Allow-globs bypass inspection entirely** in the mediator (documented
  behavior: "always allowed without inspection").
- **Masked previews reveal up to the first 3 characters / ≤ 40% of a value**
  (`maskSecret` defaults) — an explicit, documented design trade-off.
- **`guardrails connect` prints commands with unquoted absolute paths**,
  which break if the project path contains spaces. Cosmetic; the `setup`
  command writes configs directly and is unaffected.
