# CLI reference

The `guardrails` command scans for secrets, explains risks, and reports — all
locally.

```bash
# from a clone of the repo
pnpm install && pnpm build
node apps/cli/dist/main.js <command>

# or, once published
guardrails <command>
```

## Commands

| Command             | What it does                                                                           |
| ------------------- | -------------------------------------------------------------------------------------- |
| `scan [paths...]`   | Scan files/directories for secrets. Exits non-zero if any are found. Alias: `secrets`. |
| `explain [type]`    | Beginner-friendly explanation of a secret type and how to fix it.                      |
| `report [paths...]` | Generate a Markdown or JSON security report.                                           |
| `doctor`            | Check that your environment is ready.                                                  |
| `status`            | Show the current configuration.                                                        |
| `init`              | Create `.guardrails/config.json` and a default policy.                                 |
| `policies`          | List policies and their rules.                                                         |
| `config`            | Print the effective configuration as JSON.                                             |

## Examples

```bash
guardrails scan .                     # scan the whole project
guardrails scan src --json            # machine-readable output
guardrails explain openai             # learn about OpenAI keys
guardrails explain postgres -l professional
guardrails report . -f md -o report.md
guardrails doctor
```

## Exit codes

- `0` — no secrets found (or an informational command succeeded).
- `1` — secrets were found, or a usage error occurred.
- `2` — a path could not be scanned.

## Options

- `--json` (scan) — output findings as JSON. Values are always redacted.
- `-l, --level <beginner|intermediate|professional>` (explain) — tailor the
  explanation to your experience.
- `-f, --format <md|json>` and `-o, --output <file>` (report).

## Privacy

Everything runs locally. Guardrails makes no network calls and collects no
telemetry. Findings never contain the raw secret — only a location and a masked
preview.
