# Quick start

> Total beginner? Use the [full step-by-step install guide](./install-guide.md)
> instead - it explains every step and shows the expected output.

Requires Node.js ≥ 20, git, and pnpm (`npm i -g pnpm`).

## 1. Install (once per machine)

```bash
git clone https://github.com/prajwal2006/gaurdrails.git
cd gaurdrails
pnpm install && pnpm run install-cli
```

This builds everything and creates a global `guardrails` command.
Verify with `guardrails doctor`.

## 2. Protect a project (one command per project)

```bash
cd your-project
guardrails setup
```

This does everything: creates the config, installs git pre-commit/pre-push
hooks, **and detects every AI tool on your machine and writes each one's
secret-protection** (hard read-deny rules, AI ignore files, MCP registration) -
no JSON editing. Restart your AI tools once afterwards. Re-run `setup` any time
you install a new AI tool; it also reminds you on your next commit.

## 3. (Rare) Connect a tool manually

Only if a tool keeps its config somewhere unusual, or you want to see the exact
snippet:

```bash
guardrails connect               # list supported AI tools
guardrails connect claude-code   # or claude-desktop, cursor, windsurf,
                                 #    antigravity, gemini-cli, codex, copilot
```

Each prints copy-paste config with your machine's paths already filled in.
`guardrails setup` normally does this for you.

## Everyday commands

```bash
guardrails scan                # scan the current project for secrets
guardrails explain jwt         # learn why something is risky, in plain words
guardrails audit               # what has the AI been trying to read?
guardrails git fix             # add .env to .gitignore + make .env.example
guardrails report -o report.md # generate a shareable security report
```

## Use as a library

```ts
import { DetectorRegistry } from '@guardrails/secret-detector';

const registry = DetectorRegistry.withDefaults();
const findings = registry.scan({
  path: '.env',
  content: 'OPENAI_API_KEY=sk-abc123...',
});

for (const f of findings) {
  console.log(f.severity, f.title, '→', f.redactedPreview);
}
```

Nothing here touches the network. Everything runs locally.
