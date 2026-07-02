# Architecture

Guardrails follows a **clean, layered architecture**. Domain logic (secret
detection, policy evaluation, redaction) is pure and dependency-free; the outer
layers (CLI, git hooks, MCP server, desktop) are thin adapters that wire the core
to the outside world.

```
                      ┌──────────────────────────────────────────┐
   AI coding tools →  │  Adapters (MCP server, agent-adapters)     │
   Git operations  →  │  Delivery  (CLI, git hooks, daemon, desktop)│
                      └───────────────┬────────────────────────────┘
                                      │ depends on
                      ┌───────────────▼────────────────────────────┐
                      │  Application services                        │
                      │  policy-engine · redaction · reporting       │
                      └───────────────┬────────────────────────────┘
                                      │ depends on
                      ┌───────────────▼────────────────────────────┐
                      │  Domain core                                 │
                      │  secret-detector · shared (types/interfaces) │
                      └──────────────────────────────────────────────┘
```

## Dependency rule

Dependencies point **inward**. `shared` depends on nothing. `secret-detector`
depends only on `shared`. The CLI depends on everything below it but nothing
depends on the CLI. This keeps the security-critical core small, pure, and
exhaustively testable.

## Packages

| Package                       | Responsibility                                         | Depends on                         |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------- |
| `@guardrails/shared`          | Types, interfaces, `Result`, educational content model | -                                  |
| `@guardrails/secret-detector` | Pluggable multi-layer detection engine                 | shared                             |
| `@guardrails/redaction`       | Structure-preserving value redaction                   | shared                             |
| `@guardrails/policy-engine`   | Allow/deny/redact/audit decisions with inheritance     | shared                             |
| `@guardrails/core`            | Orchestration facade + filesystem scanning             | shared, secret-detector, redaction, policy-engine |
| `@guardrails/adapters`        | Normalises each AI tool to a common interface          | shared                             |
| `@guardrails/audit`           | Value-free audit sinks (memory + JSONL)                | shared                             |
| `@guardrails/git`             | Hook installation & repository scanning                | shared, secret-detector, redaction |
| `@guardrails/mcp-server`      | MCP server mediating AI file reads over stdio          | shared, core, adapters, audit      |
| `@guardrails/shield`          | Detect installed AI tools + write per-tool enforcement | shared                             |
| `@guardrails/cli`             | The `guardrails` command                               | all of the above                   |

## The shield layer

`@guardrails/shield` is the piece that makes protection *one command*. It is a
pure-ish delivery-side package (only Node `fs`/`os`/`path`, fully injectable via
`ShieldEnv`) with two responsibilities:

- **Detect** which AI coding tools exist on the machine, by looking for the
  footprints they create (`~/.claude`, `~/.cursor`, VS Code Copilot extension,
  …). Offline, instant, no elevated rights.
- **Enforce** by writing each tool's *own* configuration to the strongest level
  it supports - hard `permissions.deny` rules (Claude Code), AI ignore files
  (Cursor/Windsurf/Gemini), MCP registration (all), and standing instructions
  where no hard block exists. Two careful primitives back this:
  `managed.ts` (begin/end marker blocks in text files) and `json-file.ts`
  (parse-safe JSON merges with a one-time backup). It never disturbs existing
  user config and is safe to re-run.

`guardrails setup` composes `initConfig` + git hook install + `shieldProject`,
and records the shielded tool ids so the git hook can flag tools installed
later. See the [security guide](./security-guide.md#how-enforcement-works).

## Key design decisions

- **Pure domain core.** No filesystem or network access inside `secret-detector`
  - callers pass content in, findings come out. This makes the engine trivial to
    fuzz and unit-test, and safe to run anywhere.
- **Everything behind interfaces.** Detectors, adapters, policies, reporters, and
  notifiers are all pluggable. Third parties extend Guardrails without forking it.
- **Fail safe by default.** The default policy denies known-sensitive files and
  redacts ambiguous content.
- **No I/O of secrets.** Findings never carry the raw secret - only its location,
  a classification, and a redacted preview.

## Data flow (a scan)

1. A delivery layer (CLI / git hook / MCP) reads file content.
2. It hands `{ path, content }` to the `secret-detector` registry.
3. Each registered `Detector` returns zero or more `Finding`s.
4. The `policy-engine` maps `(finding, scope, tool)` → a `Decision`.
5. Depending on the decision, content is allowed, denied, or passed through the
   `redaction` engine.
6. Every decision is recorded as an `AuditEvent` (without the secret value).
