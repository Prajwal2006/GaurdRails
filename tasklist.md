# Guardrails — Build Task List

This is the living plan and progress tracker for Guardrails. It is organised by
phase. Each phase ships **cohesive, tested, production-quality code** before the
next begins. Legend: ✅ done · 🚧 in progress · ⬜ planned.

---

## Phase 0 — Foundation & tooling ✅

- ✅ pnpm workspaces monorepo (`packages/*`, `apps/*`)
- ✅ TypeScript strict base config + project references (lint/build split)
- ✅ ESLint v9 flat config (type-checked) + Prettier
- ✅ Vitest with coverage thresholds
- ✅ Root docs: README, LICENSE (MIT), CONTRIBUTING, tasklist
- ✅ `.gitignore` that dogfoods our own secret list
- ✅ `pnpm install` + green `pnpm run check`

## Phase 1 — `@guardrails/shared` (the contract) ✅

- ✅ Domain types: `Severity`, `Confidence`, `Finding`, `FindingSummary`
- ✅ Detector interfaces: `Detector`, `DetectionContext`, `FindingSpec`
- ✅ Policy types: `Policy`, `PolicyRule`, `Scope`, `Decision`, `DecisionAction`
- ✅ Adapter interface: `AgentAdapter`, `FileReadRequest`, `MediatedResponse`
- ✅ Audit event types (`AuditEvent`, `AuditSink`) — never contain secret values
- ✅ `Result<T, E>` helper + masking primitives (`maskSecret`, `previewSecret`)
- ✅ Educational content model (`Explanation`, `ExperienceLevel`)
- ✅ 32 unit tests incl. the "masking never leaks a full value" invariant

## Phase 2 — `@guardrails/secret-detector` ✅

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

## Phase 3 — `@guardrails/redaction` ✅

- ✅ Structure-preserving redaction (`KEY=<REDACTED>`) via detected spans
- ✅ Overlap collapsing + input-order-independent sorting
- ✅ Partial reveal option (`sk-********`) — off by default
- ✅ Custom flat token and per-finding token overrides; `Redactor` class
- ✅ Tests (13): never leaks the original value; ignores file-level findings

## Phase 4 — `@guardrails/policy-engine` ⬜

- ⬜ Policy schema + loader (JSON/YAML) with Zod validation
- ⬜ Scope matching (project/folder/file/glob/extension/tool/user)
- ⬜ Rule precedence + inheritance + deterministic resolution
- ⬜ Default fail-safe policy (deny sensitive, redact ambiguous)
- ⬜ Tests: precedence, inheritance, conflicts

## Phase 5 — `guardrails` CLI ⬜

- ⬜ Commander scaffold + colored/iconed output helpers
- ⬜ `scan`, `secrets`, `explain`, `doctor`, `status`, `report`, `config`, `init`
- ⬜ `git install` / `git verify`
- ⬜ Snapshot tests for command output

## Phase 6 — Git protection ⬜

- ⬜ Hook installer (pre-commit, pre-push) — idempotent, reversible
- ⬜ Staged-file scanner + repo scanner
- ⬜ Educational block messages + auto-fix suggestions (.gitignore, .env.example)

## Phase 7 — MCP server & agent adapters ⬜

- ⬜ `AgentAdapter` implementations (Claude Code, Codex, Cursor, Copilot, Gemini)
- ⬜ MCP server exposing only approved files
- ⬜ Allow/deny lists + audit logging

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
