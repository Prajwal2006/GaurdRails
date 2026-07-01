# Quick start

> Requires Node.js ≥ 20 and pnpm ≥ 10.

## Install

```bash
git clone https://github.com/prajwal2006/gaurdrails.git
cd gaurdrails
pnpm install
```

## Verify the toolchain

```bash
pnpm run check   # prettier + eslint + tsc + vitest
```

## Scan for secrets

Once the CLI is available:

```bash
guardrails scan .              # scan the current project
guardrails secrets ./config    # detailed secret listing
guardrails explain OPENAI_KEY  # learn why something is risky
guardrails git install         # add pre-commit / pre-push protection
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
