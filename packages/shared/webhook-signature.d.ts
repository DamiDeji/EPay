// Type shim for `@epay/shared/webhook-signature`.
//
// The runtime entry point is declared in the package `exports` map
// (`./dist/webhook-signature.js`), which bundlers and Node honour. TypeScript's
// classic `node` module resolution — still used by `apps/api` — ignores the
// `exports` field entirely, so it needs a physically present declaration file to
// find. Keep this re-export in sync with src/webhook-signature.ts.
export * from './dist/webhook-signature';
