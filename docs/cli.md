# CLI reference

The `guardrails` command scans for secrets, explains risks, guards git, and
mediates AI file access - all locally.

```bash
# install the global command from a clone of the repo (one time)
pnpm install && pnpm run install-cli

guardrails <command>
```

## Commands

| Command             | What it does                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `setup`             | One-time project setup: config + git hooks + next steps.                                 |
| `connect [tool]`    | Print copy-paste MCP config for an AI tool (paths pre-filled).                           |
| `scan [paths...]`   | Scan files/directories for secrets. Exits non-zero if any are found. Alias: `secrets`.   |
| `explain [type]`    | Beginner-friendly explanation of a secret type and how to fix it.                        |
| `report [paths...]` | Generate a Markdown or JSON security report.                                             |
| `doctor`            | Check that your environment is ready.                                                    |
| `status`            | Show the current configuration.                                                          |
| `init`              | Create `.guardrails/config.json` and a default policy.                                   |
| `policies`          | List policies and their rules.                                                           |
| `config`            | Print the effective configuration as JSON.                                               |
| `git <sub>`         | Git protection: `install`, `uninstall`, `status`, `scan`, `check`, `fix`, hooks.         |
| `mcp serve [root]`  | Run the MCP server on stdio (`--allow`, `--deny`, `--tool`, `--withhold`, `--no-audit`). |
| `mcp info`          | Describe the MCP server without starting it.                                             |
| `adapters`          | List the AI tools Guardrails can mediate.                                                |
| `audit`             | Show the value-free audit log (`--limit`, `--json`, `--file`).                           |

## Examples

```bash
guardrails setup                      # protect this project (config + hooks)
guardrails connect claude-desktop     # copy-paste MCP config for Claude Desktop
guardrails scan .                     # scan the whole project
guardrails scan src --json            # machine-readable output
guardrails explain openai             # learn about OpenAI keys
guardrails explain postgres -l professional
guardrails report . -f md -o report.md
guardrails audit --limit 20           # recent AI access decisions
guardrails doctor
```

## Behavior notes

- **Sensitive files are redacted, not hidden, by default.** When policy says
  "deny" (e.g. `.env`), the MCP server returns a copy with every value replaced
  by `<REDACTED>` plus a plain-English note. Pass `--withhold` to `mcp serve`
  to return nothing at all instead.
- **Git hooks ask before blocking** when run on an interactive terminal
  (default answer: stop). In CI or GUI clients they block silently, fail-safe.
  Bypass explicitly with `--no-verify`.

## Exit codes

- `0` - no secrets found (or an informational command succeeded).
- `1` - secrets were found, or a usage error occurred.
- `2` - a path could not be scanned.

## Options

- `--json` (scan) - output findings as JSON. Values are always redacted.
- `-l, --level <beginner|intermediate|professional>` (explain) - tailor the
  explanation to your experience.
- `-f, --format <md|json>` and `-o, --output <file>` (report).

## Privacy

Everything runs locally. Guardrails makes no network calls and collects no
telemetry. Findings never contain the raw secret - only a location and a masked
preview.
