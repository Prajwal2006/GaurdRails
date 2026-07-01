<div align="center">

# 🛡️ Guardrails

**An AI Security Layer that keeps your secrets away from AI coding assistants.**

_AI should have access to code, not secrets._

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Privacy: local-first](https://img.shields.io/badge/privacy-local--first-blue.svg)](./docs/security-guide.md)
[![Tests: Vitest](https://img.shields.io/badge/tests-vitest-6E9F18.svg)](#testing)

</div>

---

Guardrails sits between AI coding assistants (Claude Code, Codex, Copilot, Gemini
CLI, Cursor, Windsurf, …) and your project. It **detects secrets regardless of
filename**, **redacts sensitive values**, **blocks risky Git commits**, and
**explains the risk in language beginners understand** — all **100% locally**.
No data ever leaves your machine.

## Why

AI assistants are wonderful at reading your code. The problem is they read
_everything_ — including your `.env`, your `id_rsa`, your cloud credentials. One
careless prompt or one over-eager agent and a live production secret ends up in
a model's context window, a log, or a commit. Guardrails is the seatbelt: it
lets AI see your code while keeping the keys in your pocket.

## Features

- 🔎 **Multi-layer secret detection** — filename rules, provider-specific regexes
  (OpenAI, Anthropic, AWS, GitHub, Stripe, Slack, Twilio, Google, …), private-key
  and JWT detection, connection strings, and Shannon-entropy analysis.
- ✂️ **Redaction engine** — replaces values with `<REDACTED>` while preserving
  file structure, so AI still gets useful context.
- 📜 **Policy engine** — allow/deny/redact/audit rules per project, folder, file,
  extension, AI tool, user, or organization, with inheritance.
- 🪝 **Git protection** — auto-installed pre-commit / pre-push hooks that stop
  secrets before they are ever pushed.
- 🔌 **MCP server & agent adapters** — expose only approved files to AI tools
  through a common, pluggable interface.
- 🎓 **Beginner-friendly education** — every block explains _what happened, why it
  matters, and how to fix it_, at your chosen experience level.
- 🕵️ **Audit log & reports** — Markdown / HTML / JSON / PDF, and never stores the
  secret itself.
- 🏢 **Enterprise-ready by design** — RBAC, SSO, org policies, and audit exports
  are architected in from day one (and disabled by default).

## Repository layout

```
guardrails/
├── apps/
│   ├── cli/          # `guardrails` command-line tool (Commander)
│   ├── desktop/      # Electron dashboard (planned)
│   └── daemon/       # background interception service (planned)
├── packages/
│   ├── shared/         # strongly-typed domain model shared by everything
│   ├── secret-detector/# pluggable multi-layer detection engine
│   ├── redaction/      # structure-preserving value redaction
│   ├── policy-engine/  # allow/deny/redact/audit decisions with inheritance
│   ├── agent-adapters/ # Claude Code / Codex / Cursor / … adapters
│   ├── git/            # git hook installer & scanners
│   └── mcp/            # MCP server (planned)
├── docs/             # architecture, security, plugin, threat model, …
├── examples/         # runnable examples
└── tasklist.md       # living build plan & progress tracker
```

## Quick start

> Requires Node.js ≥ 20 and [pnpm](https://pnpm.io) ≥ 10.

```bash
git clone https://github.com/prajwal2006/gaurdrails.git
cd gaurdrails
pnpm install
pnpm run check      # format + lint + typecheck + test

# Scan a directory for secrets (once the CLI package is built)
pnpm --filter @guardrails/cli exec guardrails scan .
```

See [`docs/quick-start.md`](./docs/quick-start.md) for a full walkthrough.

## Design principles

| Principle             | What it means in Guardrails                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| **Privacy first**     | Everything runs locally. No telemetry. No network calls by default.         |
| **Never shame users** | Errors teach, they don't scold. Leaking a key is easy to do.                |
| **Modular**           | Adding a new AI tool or detector should be a few lines behind an interface. |
| **Strongly typed**    | TypeScript everywhere, `strict` + `noUncheckedIndexedAccess`.               |
| **Fail safe**         | When in doubt, deny. Secrets stay put unless a policy allows them.          |

## Documentation

- [Architecture](./docs/architecture.md)
- [Security guide](./docs/security-guide.md)
- [Threat model](./docs/threat-model.md)
- [Plugin guide](./docs/plugin-guide.md)
- [Contributing](./CONTRIBUTING.md)
- [Roadmap & task list](./tasklist.md)

## Testing

```bash
pnpm test            # run the whole suite
pnpm test:coverage   # with coverage (core security modules target ≥ 90%)
```

## License

[MIT](./LICENSE) — free to use, modify, and distribute.
