# Plugin guide

Everything in Guardrails is designed to be extended without forking.

## Writing a custom detector

A detector implements the `Detector` interface from `@guardrails/shared`:

```ts
import type { Detector, DetectionContext, Finding } from '@guardrails/shared';

export const acmeTokenDetector: Detector = {
  id: 'acme-token',
  title: 'ACME API token',
  kind: 'regex',
  detect(ctx: DetectionContext): Finding[] {
    const findings: Finding[] = [];
    const re = /acme_(live|test)_[A-Za-z0-9]{24}/g;
    for (const match of ctx.content.matchAll(re)) {
      findings.push(
        ctx.finding({
          detectorId: 'acme-token',
          match: match[0],
          index: match.index,
          severity: 'high',
          confidence: 'high',
          title: 'ACME API token',
        }),
      );
    }
    return findings;
  },
};
```

Register it:

```ts
import { DetectorRegistry } from '@guardrails/secret-detector';
const registry = DetectorRegistry.withDefaults();
registry.register(acmeTokenDetector);
```

## Writing an AI tool adapter

Implement `AgentAdapter` from `@guardrails/shared`. Keep adapters thin - they
translate a tool's requests into `DetectionContext`/policy calls and translate
decisions back into the tool's response format.

## Other extension points (planned)

- **Reporters** - render findings to a new format.
- **Notifiers** - deliver alerts to a new channel.
- **Policy sources** - load policies from a new backend.
