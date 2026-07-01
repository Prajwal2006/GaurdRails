# Examples

Runnable examples of using Guardrails as a library.

## `basic-scan.mjs`

Scans a small sample document with the default detector registry and prints the
findings (values are always redacted).

```bash
pnpm install
pnpm build
node examples/basic-scan.mjs
```

Expected output (abridged):

```
Found 2 issue(s). Highest severity: critical

  [critical] OpenAI API key (line 3) → sk-********…
  [high] Connection string with embedded credentials (line 4) → pos********…
```
