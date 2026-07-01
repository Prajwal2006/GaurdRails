# Contributing to Guardrails

Thanks for helping keep developers' secrets safe. 🛡️

## Ground rules

1. **Never weaken the privacy guarantee.** Guardrails must never transmit user
   data or secrets off the machine, and must never collect telemetry by default.
2. **Never log secret values.** Findings carry metadata and redacted previews -
   never the raw secret.
3. **Fail safe.** When detection is ambiguous, prefer denying/redacting over
   leaking.
4. **Teach, don't shame.** User-facing messages explain what happened and how to
   fix it.

## Getting started

```bash
pnpm install
pnpm run check   # format:check + lint + typecheck + test
```

## Project structure

This is a pnpm workspace monorepo. Each package under `packages/*` is
independently typed and tested. See [`docs/architecture.md`](./docs/architecture.md).

## Workflow

- Branch from the default branch.
- Keep commits cohesive; run `pnpm run check` before pushing.
- Add tests for new behavior. Core security modules target ≥ 90% coverage.
- Update the relevant docs and `tasklist.md`.

## Adding a new detector

Implement the `Detector` interface from `@guardrails/shared` and register it.
See [`docs/plugin-guide.md`](./docs/plugin-guide.md).

## Adding a new AI tool

Implement the `AgentAdapter` interface. Adapters should be small - most of the
logic lives in the shared engine.

## Commit style

Conventional-ish, imperative mood: `feat(secret-detector): add Stripe key rule`.

## Code of conduct

Be kind. Assume good intent. We're all here to make software safer.
