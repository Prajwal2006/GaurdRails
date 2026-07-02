# Threat model

## What Guardrails defends against

- **Accidental secret exposure to AI tools.** An AI assistant or agent reading
  `.env`, private keys, or cloud credentials while working on your code.
- **Accidental secret commits/pushes.** Secrets slipping into git history.
- **Filename-blind secrets.** A production key pasted into `notes.txt` or
  `config.json` that no filename rule would catch.

## Assets

- Developer credentials (API keys, tokens, passwords, private keys).
- The contents of protected files.
- The audit log (must not itself become a secret store - hence redaction).

## Trust boundaries

```
[ AI tool / agent ] --request--> [ Guardrails ] --allowed content--> [ AI tool ]
                                      │
                                      └── denied / redacted (with explanation)
```

Guardrails is trusted; the AI tool is **semi-trusted** (it may be over-eager but
is not assumed malicious). The developer is trusted and always in control.

## Non-goals (current)

- Guardrails is not a DLP appliance or a network firewall.
- It does not defend against a fully malicious local process with your privileges
  reading files directly - its job is to mediate the _AI tool_ and _git_ paths.
- It does not guarantee detection of every possible secret format; detection is
  best-effort and layered, and errs toward caution.

## Residual risks

- **False negatives.** Novel secret formats may evade regex/entropy. Mitigation:
  pluggable detectors, entropy fallback, and conservative defaults.
- **False positives.** Legitimate high-entropy data may be flagged. Mitigation:
  allowlists, per-project policy, and clear explanations so users can allow.
