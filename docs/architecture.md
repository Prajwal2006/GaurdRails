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
| `@guardrails/agent-adapters`  | Normalises each AI tool to a common interface          | shared                             |
| `@guardrails/git`             | Hook installation & repository scanning                | shared, secret-detector, redaction |
| `@guardrails/cli`             | The `guardrails` command                               | all of the above                   |

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
