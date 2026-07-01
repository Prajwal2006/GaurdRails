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

## Fail-safe behavior

When Guardrails is unsure, it does **not** expose the content. The default policy
denies known-sensitive files and redacts ambiguous matches. You can loosen this
per project/tool with explicit policies.

## Reporting a vulnerability

Please open a private security advisory rather than a public issue. See
[`docs/threat-model.md`](./threat-model.md) for the boundaries we defend.
