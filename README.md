<div align="center">

# 🛡️ Guardrails

**An AI Security Layer that keeps your secrets away from AI coding assistants.**

_AI should have access to code, not secrets._

[**🌐 Website**](https://gaurdrails.vercel.app/)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Privacy: local-first](https://img.shields.io/badge/privacy-local--first-blue.svg)](./docs/security-guide.md)
[![Tests: Vitest](https://img.shields.io/badge/tests-vitest-6E9F18.svg)](#testing)

</div>

---

Guardrails sits between AI coding assistants (Claude Code, Claude Desktop,
Codex, Copilot, Gemini CLI, Cursor, Windsurf, Antigravity, …) and your project.
Run **one command** and Guardrails **finds every AI tool on your machine and
writes the strongest secret-protection each one supports - no config editing**.
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

## Installation

```bash
npm install -g guardrails
```

Or run it without installing anything:

```bash
npx guardrails setup
```

Both install a single, dependency-free `guardrails` binary (Node.js ≥ 20
required). Prefer building from source? See [Development](#development).

## The one command

```bash
cd your-project
guardrails setup
```

That's the whole thing. `setup` detects Claude Code, Claude Desktop, Cursor,
Windsurf, Antigravity, Gemini CLI, Codex, and GitHub Copilot - whichever are on
your machine - and writes the enforcement each one honours: **hard read-deny
rules** where the tool supports them (Claude Code), **AI ignore files**
(`.cursorignore`, `.codeiumignore`, `.geminiignore`), **MCP registration**
everywhere (so file reads come back redacted), and **standing instructions**
where no hard block exists. You never open a JSON file. Install a new AI tool
later? Guardrails notices on your next commit and tells you to re-run `setup`.

> The point most tools miss: an AI agent's **own built-in file reader** (like
> Claude Code's `Read` tool) doesn't go through any MCP server - it reads
> straight off disk. Advisory notes in a `CLAUDE.md` don't stop it. Guardrails
> writes the tool's _real, enforced_ config (`permissions.deny`, ignore files)
> so the reader is blocked at the source. See
> [How enforcement works](./docs/security-guide.md#how-enforcement-works).

## Features

- 🛡️ **One-command shield** - `guardrails setup` detects every AI tool on your
  machine and writes each one's strongest secret-protection for you: hard
  read-deny rules, AI ignore files, and MCP registration. Zero JSON editing.
  Re-run it any time; it flags newly installed AI tools automatically.
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
- 🔌 **MCP server & agent adapters** - `setup` wires these up automatically; for
  edge cases `guardrails connect <tool>` still prints ready-to-paste config for
  Claude Code, Claude Desktop, Cursor, Windsurf, Antigravity, Gemini CLI, Codex,
  and GitHub Copilot.
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
│   ├── mcp-server/     # MCP server: mediates AI file reads over stdio
│   └── shield/         # detect AI tools + write per-tool enforcement config
├── docs/             # install guide, architecture, security, threat model, …
├── examples/         # runnable examples
├── scripts/          # install-global.mjs (creates the `guardrails` command)
└── tasklist.md       # living build plan & progress tracker
```

## Quick start

> Requires Node.js ≥ 20 and git.

**1. Install once** (creates the global `guardrails` command):

```bash
npm install -g guardrails
```

Building from source instead? See [Development](#development) - it covers
the same `guardrails` command via `pnpm run install-cli`.

**2. Protect a project** (the one command - config, git hooks, and shielding
every AI tool on your machine):

```bash
cd your-project
guardrails setup
```

That's it. `setup` detects your AI tools and writes each one's secret-protection
for you - no JSON editing. Ask your AI to read `.env` - it gets `KEY=<REDACTED>`
and a friendly explanation, or is blocked outright where the tool supports it.
Try to `git commit` a `.env` - Guardrails stops it and asks first.

**Optional - manual connect** (only if a tool has an unusual config location):

```bash
guardrails connect            # list supported tools
guardrails connect claude-code
```

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

## Development

This is a pnpm workspace: `packages/*` are the internal libraries (detection,
policy, redaction, git, MCP server, …) and `apps/cli` is the `guardrails`
command that composes them. `apps/cli` is bundled with
[esbuild](https://esbuild.github.io) into a single, dependency-free
`dist/main.cjs` - that bundle, not the workspace packages, is what gets
published to npm as the `guardrails` package.

```bash
git clone https://github.com/Prajwal2006/GaurdRails.git
cd GaurdRails
pnpm install          # requires Node.js ≥ 20 and pnpm (npm i -g pnpm)

pnpm build            # type-check everything, then bundle the CLI
pnpm test             # run the test suite
pnpm run check        # format check + lint + typecheck + test (the CI gate)

pnpm run install-cli  # build, then link `guardrails` globally from source
pnpm dev              # watch mode: reruns the CLI on save (via tsx), for quick iteration
```

Useful day-to-day scripts (see [`package.json`](./package.json) for the full list):

| Script                                       | What it does                                                       |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm build`                                 | Type-check the workspace, then bundle `apps/cli` → `dist/main.cjs` |
| `pnpm dev`                                   | Run the CLI straight from TypeScript source, restarting on save    |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest, once / watch / with coverage                               |
| `pnpm lint` / `lint:fix`                     | ESLint across the workspace                                        |
| `pnpm format` / `format:check`               | Prettier, write or check-only                                      |
| `pnpm clean`                                 | Remove build output (`dist`, `.tsbuild`) in every package          |
| `pnpm check`                                 | Everything CI runs: format check, lint, typecheck, test            |

Once built, run the bundle directly without installing anything:

```bash
node apps/cli/dist/main.cjs --help
```

## Publishing (maintainers)

Only `apps/cli` is published, as the `guardrails` package - the `packages/*`
libraries stay internal, bundled into it at build time.

```bash
# 1. Bump the version (apps/cli/package.json; keep the root package in sync if you like)
cd apps/cli && npm version <patch|minor|major>

# 2. Sanity-check what will actually ship
pnpm run check                 # from the repo root: format, lint, typecheck, test
pnpm run pack:cli              # npm pack --dry-run is run for you by `prepack`
tar -tzf apps/cli/guardrails-*.tgz   # inspect the tarball contents

# 3. Publish
pnpm run publish:cli           # pnpm --filter guardrails publish --access public
```

`prepack` / `prepublishOnly` hooks in `apps/cli/package.json` rebuild the
bundle automatically before either `npm pack` or `npm publish`/`pnpm publish`
runs, so a stale `dist/` can never ship. `apps/cli/package.json`'s `files`
field keeps the published tarball to exactly `dist/`, `README.md`, and
`LICENSE`.

## License

[MIT](./LICENSE) - free to use, modify, and distribute.
