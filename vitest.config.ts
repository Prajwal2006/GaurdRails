import { defineConfig } from 'vitest/config';

export default defineConfig({
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
