import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';

/**
 * Flat ESLint config (ESLint 9+/10+).
 *
 * Replaces the legacy `.eslintrc.js` files, which ESLint 10 refuses to read —
 * every `pnpm lint` invocation used to abort with "ESLint couldn't find an
 * eslint.config.* file" before a single rule ran, so lint was not a CI gate.
 *
 * The rule set is the same shape the legacy config asked for: `eslint:recommended`
 * plus the typescript-eslint *strict* and *stylistic* type-checked presets, with
 * a couple of rules tightened on top. Type-aware rules need the compiler, so
 * `languageOptions.parserOptions.projectService` discovers the nearest
 * `tsconfig.json` per file — which is why each workspace keeps its own tsconfig.
 *
 * `eslint-plugin-import` is deliberately replaced by `eslint-plugin-import-x`:
 * the former's latest release still calls `sourceCode.getTokenOrCommentBefore`,
 * which ESLint 10 removed, so every `import/order` run crashed the linter. It is
 * the maintained fork of the same plugin, so the rules keep their familiar shape
 * behind the `import-x/` prefix.
 *
 * Note on the compiler: typescript-eslint 8 declares `typescript <6.1` and
 * throws when it finds TypeScript 7. The root `package.json` therefore aliases
 * its `typescript` dependency to `@typescript/typescript6`, so *linting* runs on
 * the TypeScript 6 API while every workspace still builds with TypeScript 7
 * through its own dependency. See ROADMAP.md → "Toolchain".
 */

/** Every file this repo expects to be parsed as TypeScript. */
const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

/** Some plugin presets are a single config object, others an array of them. */
const asArray = (config) => (Array.isArray(config) ? config : [config]);

/**
 * Presets ship without a `files` key, which would otherwise make their parser
 * and type-aware rules apply to `.mjs`/`.js` build scripts too — where there is
 * no tsconfig to generate type information from and the rules hard-error.
 */
const scopedToTypeScript = (config) =>
  asArray(config).map((entry) => ({ ...entry, files: TS_FILES }));

/**
 * Node globals for the plain-JS build scripts (`jest.config.js`,
 * `apps/extension/build.mjs`). The legacy config ignored `*.js` entirely, so
 * these were never linted and `no-undef` never had a chance to complain about
 * `require`/`process`. Listing them explicitly avoids pulling in the `globals`
 * package for a handful of names.
 */
const NODE_GLOBALS = {
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  exports: 'writable',
  global: 'readonly',
  module: 'writable',
  process: 'readonly',
  queueMicrotask: 'readonly',
  require: 'readonly',
  setImmediate: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
};

const TEST_FILES = [
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.spec.tsx',
  '**/*.test.tsx',
  '**/test/**/*.ts',
  '**/tests/**/*.ts',
  '**/__tests__/**/*.ts',
];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/out/**',
      '**/build/**',
      '**/public/**',
      // Generated / non-source assets.
      'packages/database/prisma/migrations/**',
      'packages/contracts/optimized/**',
      'k8s/**',
      'monitoring/**',
      'helm/**',
      'gitops/**',
      'scripts/**',
      '**/*.d.ts',
    ],
  },

  js.configs.recommended,

  ...scopedToTypeScript(tseslint.configs['flat/base']),
  ...scopedToTypeScript(tseslint.configs['flat/eslint-recommended']),
  ...scopedToTypeScript(tseslint.configs['flat/strict-type-checked']),
  ...scopedToTypeScript(tseslint.configs['flat/stylistic-type-checked']),

  {
    files: TS_FILES,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // Discovers the closest tsconfig.json for each linted file.
        projectService: {
          // A handful of files intentionally sit outside a tsconfig program.
          allowDefaultProject: [
            '*.config.ts',
            '*.config.mts',
            '*.config.js',
            '*.config.mjs',
            'playwright.config.ts',
            'vitest.config.ts',
            'jest.config.js',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importPlugin,
      'unused-imports': unusedImports,
    },
    settings: {
      'import-x/resolver': {
        node: true,
        typescript: true,
      },
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'],
      },
    },
    rules: {
      // ── Carried over from the legacy .eslintrc.js ──────────────────────────
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'unused-imports/no-unused-imports': 'error',
      // `import-x/order` is only meaningful with the resolver wired up; the
      // typescript resolver above keeps it from false-positiving on workspace
      // packages like `@epay/shared`.
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      // `no-unnecessary-condition` is advisory, not a defect signal, on code
      // that predates the rule; keep it visible as a warning rather than
      // pretending it is clean.
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      // Template literals in logging/messaging mix in numbers and booleans all
      // over the codebase; those are safe to interpolate.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true, allowNullish: true },
      ],
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },

  // Tests: keep the type-aware safety net but drop the rules that only make
  // sense for production code (test doubles legitimately use `any`, unused
  // arrange-variables, and unbound methods).
  {
    files: TEST_FILES,
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'import-x/no-extraneous-dependencies': 'off',
    },
  },

  // Config files (next.config.ts, vitest.config.ts, …) sit outside the tsconfig
  // program and are plain scripts, so the whole type-aware preset is switched
  // off for them rather than left to crash at rule-load time.
  {
    files: ['**/*.config.{js,mjs,cjs,ts,mts}'],
    ...tseslint.configs['flat/disable-type-checked'],
    languageOptions: {
      ...tseslint.configs['flat/disable-type-checked'].languageOptions,
      parserOptions: { projectService: false },
      globals: NODE_GLOBALS,
    },
    rules: {
      ...tseslint.configs['flat/disable-type-checked'].rules,
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'import-x/no-default-export': 'off',
    },
  },

  // ── Packages whose build tsconfig deliberately omits files ─────────────────
  // `apps/api` excludes its specs and `test/` from the build program, and the
  // database and SDK packages omit `prisma/seed.ts` and `examples/`. Linting
  // those files with type information therefore needs an explicit project;
  // each package ships a `tsconfig.eslint.json` that extends its build config,
  // adds the missing files and emits nothing.
  // Globs are listed explicitly rather than as `<dir>/**/*.ts` plus a negation:
  // a negated pattern in `files` widens a flat-config entry to every file in the
  // run instead of narrowing it, which silently pointed unrelated packages at
  // the wrong tsconfig.
  ...[
    { dir: 'apps/api', globs: ['apps/api/src/**/*.ts', 'apps/api/test/**/*.ts'] },
    {
      dir: 'packages/database',
      globs: ['packages/database/src/**/*.ts', 'packages/database/prisma/**/*.ts'],
    },
    {
      dir: 'packages/sdk',
      globs: ['packages/sdk/src/**/*.ts', 'packages/sdk/examples/**/*.ts'],
    },
  ].map(({ dir, globs }) => ({
    files: globs,
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: [`${dir}/tsconfig.typecheck.json`],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  })),

  // Plain-JS build scripts that are not `*.config.*` (e.g. the extension's
  // esbuild bundler script). These get `eslint:recommended` on Node globals and
  // no type information.
  {
    files: ['**/*.{js,mjs,cjs}'],
    ignores: ['**/*.config.{js,mjs,cjs}'],
    languageOptions: { globals: NODE_GLOBALS },
  },

  // ── Per-surface relaxations ────────────────────────────────────────────────
  // These reproduce the intent of the five per-app `.eslintrc.js` files that
  // ESLint 10 could no longer read, so the gate starts from the team's
  // established baseline rather than from a rule set nobody had ever run.

  // NestJS API: providers legitimately return untyped Prisma rows, and module
  // classes are empty containers by design. `*.spec.ts` is deliberately NOT
  // excluded here — the legacy config ignored it, which meant the API's tests
  // were never linted at all; they are linted under the relaxed test rules
  // above instead.
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'import-x/no-unresolved': ['error', { ignore: ['^express$'] }],
    },
  },

  // Next.js dashboards, the customer web app, the indexer and the native
  // clients all consume untyped JSON (API responses, Horizon payloads), so the
  // `no-unsafe-*` family cannot be satisfied without inventing casts that make
  // the code worse. The resolver is off because bundled aliases are resolved by
  // the bundler, not by Node.
  {
    files: [
      'apps/web/**/*.{ts,tsx}',
      'apps/merchant-dashboard/**/*.{ts,tsx}',
      'apps/admin-dashboard/**/*.{ts,tsx}',
      'apps/indexer/**/*.ts',
      'apps/extension/**/*.{ts,tsx}',
      'apps/mobile/**/*.{ts,tsx}',
    ],
    rules: {
      'import-x/no-unresolved': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Must stay last: switches off every rule that would fight Prettier.
  prettier,
];
