import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      // `src/index.ts` is a pure re-export barrel: it has no behaviour of its own
      // to cover, and counting it would only depress the ratio.
      exclude: ['src/**/*.spec.ts', 'src/index.ts'],
      // Floors sit just below what the suite currently achieves. They exist to
      // stop a regression, not to celebrate a number. Never lower these to make
      // a build pass.
      thresholds: {
        lines: 90,
        statements: 90,
        branches: 80,
        functions: 95,
      },
    },
  },
});
