# Security guide

Guardrails is a security tool, so it holds itself to a high bar.

## Privacy guarantees

- **Local only.** All detection, redaction, and policy evaluation happen on your
  machine. There are no network calls in the core packages.
- **No telemetry by default.** We do not collect usage data. Any future opt-in
  telemetry will be explicit, documented, and off by default.
- **Secrets never leave your machine, and are never stored.** Findings contain a
  classification, a location, and a _redacted_ preview - never the raw value.

## How detection works

Detection is layered so no single technique has to be perfect:

1. **Filename rules** - `.env`, `id_rsa`, `*.pem`, `service-account.json`, …
2. **Provider regexes** - precise patterns for known key formats (e.g. Stripe
   `sk_live_…`, GitHub `ghp_…`, AWS `AKIA…`).
3. **Structural detectors** - PEM private-key blocks, JWTs, DB connection strings.
4. **Entropy analysis** - high-Shannon-entropy tokens that look random, with an
   allowlist to suppress common false positives (hashes, UUIDs, lockfile hashes).

Each finding has a **severity** and a **confidence**, so downstream policy can
treat a confirmed `sk_live` key differently from a merely high-entropy string.

## How enforcement works

Keeping an AI away from your secrets is the whole point, so it is worth being
precise about *how* Guardrails does it - because a friendly note in a
`CLAUDE.md` is **not** enforcement. An AI agent has two ways to reach a file:

1. **Through an MCP server** it is connected to. Guardrails registers itself as
   that server, so any `read_file` comes back redacted (`KEY=<REDACTED>`) or is
   withheld. This is real enforcement, but only for reads that go through MCP.
2. **Through its own built-in file reader** (e.g. Claude Code's `Read` tool,
   Cursor's file access). These go straight to disk and never touch an MCP
   server. This is the gap that leaks real keys - and where advisory text fails.

`guardrails setup` runs the **shield** (`@guardrails/shield`), which closes gap
2 by writing each tool's *own enforced configuration*. It never asks you to edit
a config file, and it never disturbs config you already have (managed blocks
with begin/end markers; JSON merges that keep every existing key and back the
file up once).

| Tool                | Mechanism the shield writes                                             | Enforced by        | Level          |
| ------------------- | ----------------------------------------------------------------------- | ------------------ | -------------- |
| Claude Code         | `permissions.deny` `Read(...)` rules in `.claude/settings.json` + MCP   | Claude Code harness| `blocks-reads` |
| Cursor              | `.cursorignore` + MCP registration                                      | Cursor             | `blocks-reads` |
| Windsurf            | `.codeiumignore` + MCP registration                                     | Windsurf           | `blocks-reads` |
| Gemini CLI          | `.geminiignore` + MCP registration                                      | Gemini CLI         | `blocks-reads` |
| Claude Desktop      | MCP registration (Desktop reaches files *only* via MCP)                 | MCP mediation      | `mcp-only`     |
| Codex CLI           | MCP registration + `AGENTS.md` standing instruction                     | MCP + instruction  | `advisory`     |
| GitHub Copilot      | `.vscode/mcp.json` + `copilot-instructions.md` (+ optional repo exclusion) | MCP + instruction | `advisory`     |
| Antigravity         | `AGENTS.md` + a surfaced manual step (no safe config file yet)          | instruction        | `manual`       |

Where a hard block is not available (Codex, Copilot, Antigravity), the shield is
honest about it: it reports the level as `advisory`/`manual` and surfaces the
manual step (e.g. GitHub's repo-level Copilot content exclusion). Even then, the
**git hooks are the backstop** - if any agent reads a secret and tries to commit
it, the commit is blocked before anything leaves your machine.

The exact deny rules and ignore patterns live in one place -
`packages/shield/src/constants.ts` (`CLAUDE_DENY_RULES`, `SECRET_IGNORE_PATTERNS`,
`ADVISORY_LINES`) - and mirror the filename detector's high-signal rules.

### New AI tools installed later

The shield records which tools it protected in `.guardrails/config.json`. On
your next `git commit`/`push`, the hook re-detects your AI tools and, if a new
one appeared, prints a one-line heads-up telling you to re-run `guardrails
setup`. It is purely informational - it never blocks the commit and never
throws.

## Fail-safe behavior

When Guardrails is unsure, it does **not** expose the content. The default policy
denies known-sensitive files and redacts ambiguous matches. You can loosen this
per project/tool with explicit policies.

## Reporting a vulnerability

Please open a private security advisory rather than a public issue. See
[`docs/threat-model.md`](./threat-model.md) for the boundaries we defend.
