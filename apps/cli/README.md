# 🛡️ guardrails

An AI Security Layer that keeps your secrets away from AI coding assistants
(Claude Code, Claude Desktop, Codex, Copilot, Gemini CLI, Cursor, Windsurf,
Antigravity, …). 100% local - no telemetry, no network calls.

## Install

```bash
npm install -g guardrails-cli
```

Or run it without installing anything:

```bash
npx guardrails-cli setup
```

## Use

```bash
cd your-project
guardrails setup
```

`setup` detects every AI coding tool on your machine and writes the strongest
secret-protection each one supports - hard read-deny rules, AI ignore files,
and MCP registration - so secrets never reach an AI model's context window,
and installs git hooks that stop `.env` and key files from being committed or
pushed.

```
guardrails --help          # every command
guardrails scan            # scan the current project for secrets
guardrails doctor          # verify your environment is ready
guardrails explain <type>  # learn what a finding means and how to fix it
guardrails audit           # see what AI tools have tried to read
```

Full documentation, architecture, and the threat model live in the main
repository: <https://github.com/Prajwal2006/GaurdRails>.

## License

MIT - see [LICENSE](./LICENSE).
