const { compilerOptions } = require('./tsconfig.json');

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // `allowJs` is what lets ts-jest compile the handful of ESM-only
    // dependencies that `@stellar/stellar-sdk` pulls in (see
    // `transformIgnorePatterns` below) down to the CommonJS this suite runs as.
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: { ...compilerOptions, allowJs: true },
      },
    ],
  },
  // Jest skips `node_modules` by default, which means a package that ships only
  // ESM would be handed to Node untransformed and blow up with
  // "SyntaxError: Unexpected token 'export'". `uint8array-extras` is exactly
  // that package and is reachable from every `@stellar/stellar-sdk` entrypoint,
  // so it (and the SDK itself, for future-proofing) must be transformed.
  //
  // The optional `\.pnpm/[^/]+/node_modules/` branch is required because pnpm
  // does not store packages at `node_modules/<name>` — it stores them at
  // `node_modules/.pnpm/<name>@<version>/node_modules/<name>/`, so a plain
  // `(?!uint8array-extras/)` lookahead never matches the real path.
  // `[.]` rather than `\.`: inside a JS string a lone `\.` collapses to `.`,
  // which as a regex metacharacter matches *any* character.
  transformIgnorePatterns: [
    '/node_modules/(?!([.]pnpm/[^/]+/node_modules/)?(@stellar/stellar-sdk|@exodus/bytes|@noble/ed25519|@noble/hashes|is-retry-allowed|uint8array-extras)/)',
  ],
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.dto.ts',
  ],
  coverageDirectory: './coverage',
  // Coverage must not silently regress. These floors are set just below the
  // level the suite currently achieves (lines ~54%, branches ~67%, functions
  // ~72%); they exist to stop a regression, not to celebrate a number. The
  // project target is 80% overall and 90% for payment/refund/settlement/auth —
  // see docs/TESTING.md for what is still missing. Raise these as the gaps are
  // closed; never lower them to make a build pass.
  coverageThreshold: {
    global: {
      lines: 50,
      statements: 50,
      branches: 60,
      functions: 70,
    },
  },
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^../../test/(.*)$': '<rootDir>/test/$1',
  },
  roots: ['<rootDir>/src'],
};
