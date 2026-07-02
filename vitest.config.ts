import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript source so tests never need a
// build step and always run against the latest code.
const pkg = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@guardrails/shared': pkg('shared'),
      '@guardrails/secret-detector': pkg('secret-detector'),
      '@guardrails/redaction': pkg('redaction'),
      '@guardrails/policy-engine': pkg('policy-engine'),
      '@guardrails/audit': pkg('audit'),
      '@guardrails/adapters': pkg('adapters'),
      '@guardrails/git': pkg('git'),
      '@guardrails/mcp-server': pkg('mcp-server'),
      '@guardrails/shield': pkg('shield'),
      '@guardrails/core': pkg('core'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/types.ts', '**/*.d.ts'],
      thresholds: {
        // Core security modules are held to a high bar (see tasklist.md).
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
