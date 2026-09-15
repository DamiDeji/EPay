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
      // `src/index.ts` is a pure re-export barrel. `src/__tests__` holds the
      // specs themselves.
      exclude: ['src/**/*.spec.ts', 'src/index.ts', 'src/__tests__/**'],
      // Floors sit just below what the suite currently achieves. They exist to
      // stop a regression, not to celebrate a number. Never lower these to make
      // a build pass — add the missing test instead.
      thresholds: {
        lines: 85,
        statements: 85,
        branches: 65,
        functions: 90,
      },
    },
  },
});
