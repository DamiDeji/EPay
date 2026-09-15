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
      // `src/testing` holds XDR encoding helpers used only to build fixtures.
      exclude: ['src/**/*.spec.ts', 'src/testing/**', 'src/index.ts'],
      // Floors sit just below what the suite currently achieves (lines ~96%,
      // branches ~87%, functions ~89%). They exist to stop a regression, not to
      // celebrate a number. Never lower these to make a build pass.
      thresholds: {
        lines: 90,
        statements: 90,
        branches: 80,
        functions: 85,
      },
    },
  },
});
