/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'ES2022',
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
      }
    }],
  },
  testTimeout: 30000,
  verbose: true,
};
