# Guardrails - Build Task List

This is the living plan and progress tracker for Guardrails. It is organised by
phase. Each phase ships **cohesive, tested, production-quality code** before the
next begins. Legend: ✅ done · 🚧 in progress · ⬜ planned.

---

## Phase 0 - Foundation & tooling ✅

- ✅ pnpm workspaces monorepo (`packages/*`, `apps/*`)
- ✅ TypeScript strict base config + project references (lint/build split)
- ✅ ESLint v9 flat config (type-checked) + Prettier
- ✅ Vitest with coverage thresholds
- ✅ Root docs: README, LICENSE (MIT), CONTRIBUTING, tasklist
- ✅ `.gitignore` that dogfoods our own secret list
- ✅ `pnpm install` + green `pnpm run check`

## Phase 1 - `@guardrails/shared` (the contract) ✅

- ✅ Domain types: `Severity`, `Confidence`, `Finding`, `FindingSummary`
- ✅ Detector interfaces: `Detector`, `DetectionContext`, `FindingSpec`
- ✅ Policy types: `Policy`, `PolicyRule`, `Scope`, `Decision`, `DecisionAction`
- ✅ Adapter interface: `AgentAdapter`, `FileReadRequest`, `MediatedResponse`
- ✅ Audit event types (`AuditEvent`, `AuditSink`) - never contain secret values
- ✅ `Result<T, E>` helper + masking primitives (`maskSecret`, `previewSecret`)
- ✅ Educational content model (`Explanation`, `ExperienceLevel`)
- ✅ 32 unit tests incl. the "masking never leaks a full value" invariant

## Phase 2 - `@guardrails/secret-detector` ✅

- ✅ Pluggable `DetectorRegistry` (register/unregister, fail-safe isolation)
- ✅ Filename detector (`.env`, keys, cloud creds, kubeconfig, …) with example-file skip
- ✅ 25+ provider regex detectors (OpenAI, Anthropic, AWS, GitHub PAT, Stripe,
  Slack, Twilio, Google, SendGrid, npm, DigitalOcean, Shopify, HF, …)
- ✅ Private key / certificate detector (PEM blocks, any type)
- ✅ JWT detector with real base64 header validation
- ✅ Connection-string detector (Postgres, MySQL, Mongo, Redis, AMQP, …)
- ✅ Keyword-assignment detector (hard-coded passwords/tokens, any filename)
- ✅ Shannon-entropy detector with tunable threshold + allowlist
- ✅ De-dupe + overlap suppression + line/column + redacted preview
- ✅ 100% line coverage on the engine; 113 detector tests (true/false positives)

## Phase 3 - `@guardrails/redaction` ✅

- ✅ Structure-preserving redaction (`KEY=<REDACTED>`) via detected spans
- ✅ Overlap collapsing + input-order-independent sorting
- ✅ Partial reveal option (`sk-********`) - off by default
- ✅ Custom flat token and per-finding token overrides; `Redactor` class
- ✅ Tests (13): never leaks the original value; ignores file-level findings

## Phase 4 - `@guardrails/policy-engine` ✅

- ✅ Policy schema + loader with a hand-rolled, dependency-free validator
  (`parsePolicy` / `parsePolicyJson` → `Result`)
- ✅ Scope matching: project / glob path / extension / tool / user / org
  (tiny auditable glob matcher supporting `*`, `**`, `?`)
- ✅ Rule precedence (priority, own-wins-ties) + `extends` inheritance with
  cycle guard + deterministic resolution
- ✅ Default fail-safe policy (deny sensitive/high, redact medium, audit low,
  allow code) + severity-based fail-safe fallback
- ✅ `PolicyEngine.evaluate` / `evaluateFindings`; 44 tests, 100% line coverage

## Phase 5 - `@guardrails/core` + `guardrails` CLI ✅

- ✅ `@guardrails/core` facade composing detection + policy + redaction
  (`Guardrails.inspect` / `.redact`, worst-outcome verdict)
- ✅ Educational catalog for all 13 categories (beginner/intermediate/pro) +
  alias resolution (`openai`, `aws`, `postgres`, …)
- ✅ Filesystem scanner (walks dirs, skips ignores/binary/oversized files)
- ✅ Commander CLI with colored/iconed output (no color dep; NO_COLOR aware)
- ✅ Commands: `scan`/`secrets`, `explain`, `report`, `doctor`, `status`,
  `init`, `policies`, `config`
- ✅ Testable command layer (IO abstraction); 33 CLI/core tests; verified by
  running the built binary end-to-end

## Phase 6 - Git protection ✅

- ✅ `@guardrails/git` package (staged + repo scanning, hook management)
- ✅ Hook installer (pre-commit, pre-push) - idempotent, reversible, preserves
  any pre-existing hook content (begin/end marker block)
- ✅ Staged-file scanner (`scanStaged`) + repo scanner (`scanTracked`), binary /
  oversized skip, worst-outcome verdict, blocked flag
- ✅ Educational block messages + auto-fix suggestions (`.gitignore`,
  `.env.example`) with pure builders and on-disk `applyFixes`
- ✅ CLI: `guardrails git install|uninstall|status|scan|check|fix|pre-commit|pre-push`
- ✅ 44 tests incl. real-git integration; secrets never leaked in messages

## Phase 7 - MCP server & agent adapters ✅

- ✅ `@guardrails/adapters` - `AgentAdapter` implementations (Claude Code, Codex,
  Copilot, Gemini CLI, Cursor, Windsurf) + `AdapterRegistry`, shared normalizer
- ✅ `@guardrails/audit` - `AuditSink` implementations (`MemoryAuditSink`,
  `JsonlAuditSink`) + value-free `createAuditEvent`
- ✅ `@guardrails/mcp-server` - `Mediator` (allow/deny lists + Guardrails engine +
  audit logging), MCP `McpServer` (JSON-RPC 2.0: initialize/tools) exposing only
  `read_file` / `list_files`, stdio transport, path-traversal-guarded file source
- ✅ CLI: `guardrails mcp serve|info`, `guardrails adapters`, `guardrails audit`
- ✅ 60+ tests; denied files never returned, redaction verified, audit is value-free

## Phase 8 - `@guardrails/shield`: one-command, zero-config enforcement ✅

The headline feature: **one command detects every AI tool on the machine and
writes the strongest secret-protection each one supports - no JSON editing.**
This closes the gap where an agent's _own_ built-in file reader (e.g. Claude
Code's `Read` tool) bypassed the MCP server and read real keys off disk.

- ✅ `@guardrails/shield` package - detection + enforcement writers, fully
  injectable environment (`GUARDRAILS_HOME` / `GUARDRAILS_APPDATA`) so it is
  hermetically testable
- ✅ `detectTools` - offline footprint detection for Claude Code, Claude Desktop,
  Cursor, Windsurf, Antigravity, Gemini CLI, Codex, GitHub Copilot (VS Code)
- ✅ Per-tool enforcement writers, strongest mechanism each tool offers:
  - **Claude Code** - hard `permissions.deny` `Read(...)` rules in
    `.claude/settings.json` (harness-enforced, blocks its built-in reader) +
    `.mcp.json` registration + `CLAUDE.md` advisory (`blocks-reads`)
  - **Cursor / Windsurf / Gemini** - AI ignore files (`.cursorignore`,
    `.codeiumignore`, `.geminiignore`) + MCP registration (`blocks-reads`)
  - **Claude Desktop** - MCP registration in the shared config; reaches files
    only through MCP, so registration _is_ the enforcement (`mcp-only`)
  - **Codex / Copilot** - MCP registration + standing instructions
    (`AGENTS.md` / `copilot-instructions.md`) where no hard block exists
    (`advisory`), with the manual content-exclusion step surfaced
  - **Antigravity** - advisory + surfaced manual step (`manual`)
- ✅ `managed.ts` - reusable begin/end marker block editing for plain-text
  configs (idempotent create/append/update/remove, preserves user content)
- ✅ `json-file.ts` - safe JSON merge that never touches an unparseable file,
  keeps every existing key, and writes a one-time `.guardrails-backup`
- ✅ `guardrails setup` runs the shield automatically and prints a per-tool
  enforcement report; records `shieldedTools` in `.guardrails/config.json`
- ✅ New-tool watch: the git hook flags any AI tool installed _after_ setup and
  tells the user to re-run `guardrails setup` (never blocks, never throws)
- ✅ 27 shield tests + hermetic end-to-end (fake home, 7 tools) + idempotent
  re-run; all 398 tests green

## Later phases ⬜

### Phase 9 - Hardening the shield (next up; start here if continuing) ⬜

- ⬜ `guardrails shield status` command - show, per detected tool, which
  enforcement files exist, whether the managed block is current, and the
  effective protection level (reuse `ToolShieldResult`)
- ⬜ `guardrails shield remove` command - reverse every managed block / JSON
  entry the shield wrote (uses `removeManagedBlock` + JSON un-merge); must be
  as idempotent and non-destructive as `apply`
- ⬜ Verification pass: after writing config, re-detect and confirm each hard
  block is in place; downgrade the reported `level` if a write was skipped
- ⬜ Broaden detection: JetBrains AI Assistant, Zed, Cline/Roo, Aider,
  Continue.dev, Amazon Q, Sourcegraph Cody (add ids to `SHIELDABLE_TOOL_IDS`,
  paths to `detect.ts`, and an applier in `apply.ts` - one place each)
- ⬜ `guardrails setup --dry-run` - print what _would_ change without writing
- ⬜ Cross-check `CLAUDE_DENY_RULES` / `SECRET_IGNORE_PATTERNS` against the
  filename detector's rule list with a test that fails if they drift apart
- ⬜ Windows path edge cases in `serveArgs` (spaces in project path) - add a
  test that a project path with spaces produces valid JSON args

### Phase 10 - Desktop app ⬜

- ⬜ Electron dashboard, live monitoring, policy editor, one-click shield

### Phase 11 - Reports & notifications ⬜

- ⬜ HTML / PDF reports (Markdown + JSON already ship)
- ⬜ Notifications (desktop, then Slack/Teams/Discord/email)

### Phase 12 - Enterprise & daemon ⬜

- ⬜ Enterprise (SSO, RBAC, org policies, audit exports)
- ⬜ Daemon / filesystem interception layer (catch reads no config can block)

---

## Continuation notes (read this if you picked up mid-build)

The project is a pnpm monorepo. To get oriented quickly:

- `pnpm install` → `pnpm run build` → `pnpm test` (398 tests should pass).
- The shield lives in `packages/shield`. Its public API is re-exported from
  `packages/shield/src/index.ts`. The orchestrator is `apply.ts:shieldProject`.
- To add a new AI tool end-to-end: add its id to `SHIELDABLE_TOOL_IDS` and a
  detection entry in `detect.ts`, then add an applier in `apply.ts` and wire it
  into the `APPLIERS` map. Add a matching guide in `apps/cli/src/commands/
connect.ts` for the manual fallback. Cover it with a test in
  `packages/shield/src/apply.test.ts`.
- Enforcement patterns (deny rules, ignore globs, advisory text) are all in
  `packages/shield/src/constants.ts` - change them in one place.
- Tests stay hermetic by pointing `GUARDRAILS_HOME` / `GUARDRAILS_APPDATA` at a
  temp dir; never touch the real home directory in a test.

---

## Cross-cutting requirements (every phase)

- Strongly typed, no `any` in public APIs.
- No secret value is ever logged, stored, or transmitted.
- Beginner-friendly educational messaging.
- Docs updated alongside code.
- Tests green; core security modules target ≥ 90% coverage.
