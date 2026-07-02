<div align="center">

# 🛡️ Guardrails

**An AI Security Layer that keeps your secrets away from AI coding assistants.**

_AI should have access to code, not secrets._

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Privacy: local-first](https://img.shields.io/badge/privacy-local--first-blue.svg)](./docs/security-guide.md)
[![Tests: Vitest](https://img.shields.io/badge/tests-vitest-6E9F18.svg)](#testing)

</div>

---

Guardrails sits between AI coding assistants (Claude Code, Claude Desktop,
Codex, Copilot, Gemini CLI, Cursor, Windsurf, Antigravity, …) and your project.
It **detects secrets regardless of filename**, **hands the AI a redacted copy
instead of your real values**, **stops `git commit` / `git push` from shipping
secrets (and asks you first)**, and **explains every decision in language
beginners understand** - all **100% locally**. No data ever leaves your
machine.

## Why

AI assistants are wonderful at reading your code. The problem is they read
_everything_ - including your `.env`, your `id_rsa`, your cloud credentials. One
careless prompt or one over-eager agent and a live production secret ends up in
a model's context window, a log, or a commit. Guardrails is the seatbelt: it
lets AI see your code while keeping the keys in your pocket.

## Features

- 🔎 **Multi-layer secret detection** - filename rules, provider-specific regexes
  (OpenAI, Anthropic, AWS, GitHub, Stripe, Slack, Twilio, Google, …), private-key
  and JWT detection, connection strings, and Shannon-entropy analysis.
- ✂️ **Redaction engine** - replaces values with `<REDACTED>` while preserving
  file structure, so AI still gets useful context. When an AI asks for `.env`,
  it receives the redacted copy plus a plain-English note - your real values
  stay on your machine.
- 📜 **Policy engine** - allow/deny/redact/audit rules per project, folder, file,
  extension, AI tool, user, or organization, with inheritance.
- 🪝 **Git protection** - auto-installed pre-commit / pre-push hooks that stop
  secrets before they are pushed, explain the risk in beginner terms, and ask
  you on your terminal before allowing an override.
- 🔌 **MCP server & agent adapters** - one `guardrails connect <tool>` prints
  ready-to-paste config for Claude Code, Claude Desktop, Cursor, Windsurf,
  Antigravity, Gemini CLI, Codex, and GitHub Copilot.
- 🎓 **Beginner-friendly education** - every block explains _what happened, why it
  matters, and how to fix it_, at your chosen experience level.
- 🕵️ **Audit log & reports** - Markdown / HTML / JSON / PDF, and never stores the
  secret itself.
- 🏢 **Enterprise-ready by design** - RBAC, SSO, org policies, and audit exports
  are architected in from day one (and disabled by default).

## Repository layout

```
guardrails/
├── apps/
│   └── cli/            # `guardrails` command-line tool (Commander)
├── packages/
│   ├── shared/         # strongly-typed domain model shared by everything
│   ├── secret-detector/# pluggable multi-layer detection engine
│   ├── redaction/      # structure-preserving value redaction
│   ├── policy-engine/  # allow/deny/redact/audit decisions with inheritance
│   ├── core/           # orchestration facade + filesystem scanning
│   ├── adapters/       # Claude Code / Codex / Cursor / … adapters
│   ├── audit/          # value-free audit sinks (memory + JSONL)
│   ├── git/            # git hook installer & scanners
│   └── mcp-server/     # MCP server: mediates AI file reads over stdio
├── docs/             # install guide, architecture, security, threat model, …
├── examples/         # runnable examples
├── scripts/          # install-global.mjs (creates the `guardrails` command)
└── tasklist.md       # living build plan & progress tracker
```

## Quick start

> Requires Node.js ≥ 20, git, and [pnpm](https://pnpm.io) (`npm i -g pnpm`).

**1. Install once** (creates the global `guardrails` command):

```bash
git clone https://github.com/prajwal2006/gaurdrails.git
cd gaurdrails
pnpm install && pnpm run install-cli
```

**2. Protect a project** (config + git hooks, one command):

```bash
cd your-project
guardrails setup
```

**3. Shield your AI tool** (prints copy-paste config, paths pre-filled):

```bash
guardrails connect            # list supported tools
guardrails connect claude-code
```

That's it. Ask your AI to read `.env` - it gets `KEY=<REDACTED>` and a friendly
explanation. Try to `git commit` a `.env` - Guardrails stops it and asks first.

📘 **New to this? Follow the [step-by-step install guide](./docs/install-guide.md)** -
it assumes nothing and shows what every step should print.

## Design principles

| Principle             | What it means in Guardrails                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| **Privacy first**     | Everything runs locally. No telemetry. No network calls by default.         |
| **Never shame users** | Errors teach, they don't scold. Leaking a key is easy to do.                |
| **Modular**           | Adding a new AI tool or detector should be a few lines behind an interface. |
| **Strongly typed**    | TypeScript everywhere, `strict` + `noUncheckedIndexedAccess`.               |
| **Fail safe**         | When in doubt, deny. Secrets stay put unless a policy allows them.          |

## Documentation

- **[Install & use guide](./docs/install-guide.md) - start here**
- [CLI reference](./docs/cli.md)
- [Architecture](./docs/architecture.md)
- [Security guide](./docs/security-guide.md)
- [Threat model](./docs/threat-model.md)
- [Plugin guide](./docs/plugin-guide.md)
- [Developer setup & testing](./docs/testing-and-setup.md)
- [Contributing](./CONTRIBUTING.md)
- [Roadmap & task list](./tasklist.md)

## Testing

```bash
pnpm test            # run the whole suite
pnpm test:coverage   # with coverage (core security modules target ≥ 90%)
```

## License

[MIT](./LICENSE) - free to use, modify, and distribute.
