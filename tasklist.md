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

## Later phases ⬜

- ⬜ Desktop app (Electron dashboard, live monitoring, policy editor)
- ⬜ Reports (Markdown/HTML/JSON/PDF)
- ⬜ Notifications (desktop, then Slack/Teams/Discord/email)
- ⬜ Enterprise (SSO, RBAC, org policies, audit exports)
- ⬜ Daemon / filesystem interception layer

---

## Cross-cutting requirements (every phase)

- Strongly typed, no `any` in public APIs.
- No secret value is ever logged, stored, or transmitted.
- Beginner-friendly educational messaging.
- Docs updated alongside code.
- Tests green; core security modules target ≥ 90% coverage.
