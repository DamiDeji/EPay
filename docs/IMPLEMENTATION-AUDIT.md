# EPay — Implementation Audit

**Status of this document:** this is the Phase-0 audit of the EPay repository as it
actually is, verified by running the toolchain — not by reading the README. Every
finding below is reproducible with the command listed next to it.

**Audited:** 2026-09-14
**Commit range:** `main` @ audit start
**Method:** dependencies installed (`pnpm install --frozen-lockfile`), TypeScript
toolchain run per package, Rust toolchain 1.98.1 installed, all 16 Soroban
contracts built, and every test suite executed.

**Reading this document later.** Sections 1–18 are the audit **as it was on
2026-09-14** and are deliberately left in the past tense of that day; they are
the evidence for the fixes in
[`FINAL-ENGINEERING-REPORT.md`](./FINAL-ENGINEERING-REPORT.md). Two tables below
are annotated with what happened afterwards, because they are the ones a reader
would otherwise act on: §5 (_Empty tests_) and §19 (_Recommended next fixes_),
both updated 2026-09-15.

Priority legend: **P0** critical (blocks a release, or a security/financial
correctness defect) · **P1** high · **P2** medium · **P3** low.

---

## 1. Executive summary

EPay's architecture is sound and its scope is real, but at the start of this
audit the repository **did not build, did not lint, and most of its smart
contract tests had never executed once**.

The three most severe findings:

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                 | Evidence                                                                              | Priority |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| 1   | **Only 4 of 16 Soroban contracts compiled.** Four crates declared a `std` feature that `soroban-sdk 21` does not have, so `cargo build` failed for the whole workspace, and a missing `testutils` dev-dependency meant 11 more test suites could not compile.                                                                                                                                                           | `cargo build --workspace` → 4 crates failed; `cargo test -p <contract>` → 12 failures | P0       |
| 2   | **12 of 16 contract test suites had never run**, because they did not compile. They referenced methods that do not exist (`get_next_id`, `Address::from_str`, `Address::zero`, `client.issue_badge`), used `format!`/`vec!` inside `#![no_std]`, used `env.current_contract_address()` outside a contract invocation, and asserted on APIs the contracts never exposed. `ROADMAP.md` was presenting this as "complete". | `cargo test -p role-manager` → `E0433 cannot find type Vec`                           | P0       |
| 3   | **`PaymentRouter.confirm_payment` was unauthenticated**, so any address could confirm an arbitrary payment id and drain the contract's pooled fee balance. `create_payment` was also unauthenticated, letting anyone mint a payment record naming themselves as merchant.                                                                                                                                               | `packages/contracts/contracts/payment-router/src/lib.rs` (pre-fix)                    | P0       |

Also P0, on the TypeScript side:

| #   | Finding                                                                                                                                                                                   | Evidence                                                          | Priority |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| 4   | `@epay/database` could not run Prisma at all: Prisma 7 removed the built-in driver, so a driver adapter (`@prisma/adapter-pg`) and a `prisma.config.ts` are mandatory. Both were missing. | `prisma migrate deploy` → `PrismaClientInitializationError`       | P0       |
| 5   | 116 of 117 API tests could not load: `@stellar/stellar-sdk@17` pulls in ESM-only packages that Jest does not transform.                                                                   | `jest` → `SyntaxError: Unexpected token 'export'`                 | P0       |
| 6   | `pnpm lint` had no effect — the repo configured ESLint 10 with the legacy `.eslintrc.js` format, which no longer supports `extends`.                                                      | `pnpm lint` → eslint aborts without linting                       | P0       |
| 7   | `@epay/api` did not typecheck, even though `ROADMAP.md` listed typecheck as green. The old `tsconfig.json` excluded `*.spec.ts` and `test/`, so the failures were invisible.              | `tsc --noEmit` in `apps/api` → 182 errors once specs are included | P0       |
| 8   | **Webhook deliveries were never sent.** `WebhookDispatcherService.processDue()` existed but had no caller and no scheduler, so `createDelivery` rows accumulated forever.                 | `grep -rn processDue` → only its own definition                   | P0       |

---

## 2. Current architecture (verified)

```
epay/                              pnpm workspace + Turborepo
├── apps/
│   ├── api/              NestJS + Fastify REST API (19 modules, 136 jest tests)
│   ├── web/              Next.js customer app
│   ├── merchant-dashboard/ Next.js merchant app
│   ├── admin-dashboard/  Next.js admin app
│   ├── indexer/          Soroban event indexer (7 handlers, 0 tests)
│   ├── mobile/           Expo / React Native (11 tests)
│   └── extension/        Browser wallet extension (12 tests)
├── packages/
│   ├── contracts/        16 Soroban contracts (cargo workspace, 272 tests)
│   ├── database/         Prisma schema + migrations + seed
│   ├── sdk/              @epay/sdk typed client (91 tests)
│   ├── shared/           crypto/validation helpers (17 tests)
│   ├── config/           zod-validated env config
│   ├── types/            shared TypeScript types
│   ├── ui/               React component library
│   └── hooks/            shared React hooks
├── helm/epay/            Helm chart (source of truth for k8s)
├── k8s/manifests.yaml    Generated from the chart; CI checks for drift
├── monitoring/           Prometheus scrape config, alert rules, Grafana
└── tests/                Playwright E2E + k6 load tests (not run in CI)
```

### Soroban contracts

| Contract             | Tests | Role                                                          |
| -------------------- | ----- | ------------------------------------------------------------- |
| PaymentRouter        | 17    | payment creation, confirmation, fee retention, refunds        |
| InvoiceManager       | 16    | invoice lifecycle                                             |
| EscrowManager        | 30    | milestone escrow: fund / complete / dispute / cancel / refund |
| RefundManager        | 23    | refund request → approve → complete                           |
| SubscriptionManager  | 13    | recurring billing                                             |
| SettlementManager    | 13    | merchant settlement + fee split                               |
| MerchantRegistry     | 16    | merchant registration, verification, suspension               |
| TreasuryVault        | 15    | platform fund custody + transaction ledger                    |
| FeeManager           | 15    | basis-point fee configuration                                 |
| ConfigurationManager | 11    | platform-wide settings                                        |
| EmergencyPause       | 12    | global circuit breaker                                        |
| RoleManager          | 12    | RBAC role assignment                                          |
| UpgradeManager       | 21    | two-step admin transfer, timelocked upgrades                  |
| PriceOracle          | 16    | multi-asset price feeds and conversion                        |
| Governance           | 23    | badge-gated proposal voting                                   |
| ImpactNFT            | 19    | soulbound reputation badges                                   |

---

## 3. Implemented features (verified by tests)

- **Contracts** — all 16 above, 272 tests passing.
- **API** — auth (Ed25519 wallet signatures + API keys), payments, invoices,
  escrow, refunds, subscriptions, settlements, treasury, merchants, webhooks,
  analytics, audit logs, notifications, health, metrics, AI assistant.
- **SDK** — typed resources for payments, invoices, escrow, refunds,
  subscriptions, settlements, merchants, webhooks, wallets.
- **Observability** — Prometheus metrics registry, health/readiness endpoints,
  alert rules under `monitoring/prometheus/rules/`.
- **Deployment** — Docker, Helm chart, raw manifests, backup/restore scripts.

## 4. Incomplete / placeholder implementations (pre-fix)

| Item                  | Detail                                                                | Priority |
| --------------------- | --------------------------------------------------------------------- | -------- |
| Webhook delivery      | Dispatcher existed, nothing called it (`processDue()` was dead code). | P0       |
| `@epay/ui` components | Present but unused by any app.                                        | P3       |
| `packages/hooks`      | Present, lightly used.                                                | P3       |
| `signaturePad` util   | `divisor` parameter was ignored (dead parameter).                     | P3       |

## 5. Empty tests

| Package                   | Test script                    | Reality                                                            |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------ |
| `apps/indexer`            | `vitest run --passWithNoTests` | **0 tests** for 15 modules that parse untrusted blockchain events. |
| `apps/web`                | `vitest run --passWithNoTests` | 0 tests                                                            |
| `apps/merchant-dashboard` | `vitest run --passWithNoTests` | 0 tests                                                            |
| `apps/admin-dashboard`    | `vitest run --passWithNoTests` | 0 tests                                                            |

`--passWithNoTests` means CI reports these as green. That flag is doing real
harm: it converts "never written" into "passing".

**Since addressed (2026-09-15).** `apps/indexer` has 114 tests across 10 files
with enforced coverage floors (lines ≥ 90, branches ≥ 80) and 96% line coverage;
the three dashboards share session/route-guard specs (17 tests) against the
helpers that moved into `@epay/shared`; every test script now runs a real suite
and no package uses `--passWithNoTests`. The exact counts are in
[`docs/TESTING.md`](./TESTING.md).

## 6. Weak tests

- Several API specs asserted behaviour that did not match the implementation
  (e.g. an auth spec constructed a signature with `Buffer.toString('base64')` on
  a `Uint8Array`, producing `"147,215,..."` instead of base64, and therefore
  asserted that a _valid_ signature is rejected).
- Contract specs asserted on APIs that never existed, so they were green in a
  file nobody could compile.
- Coverage is **collected but never enforced**: no Jest/Vitest `thresholds` are
  configured anywhere, so coverage can regress silently.

## 7. Missing tests

- Indexer: no coverage of checkpointing, duplicate-event suppression, crash
  recovery, malformed events, or backoff.
- E2E (`tests/e2e/*.spec.ts`): present but not wired into CI.
- No idempotency/retry tests at the API level.
- No load/perf gates (k6 scripts exist, are not run).

## 8. Security weaknesses (pre-fix)

| ID  | Finding                                                                                                                                                                      | Priority |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | `PaymentRouter::confirm_payment` unauthenticated → forged confirmation could release/refund funds and drain pooled fees.                                                     | P0       |
| S2  | `PaymentRouter::create_payment` unauthenticated → anyone could mint a payment record for themselves.                                                                         | P0       |
| S3  | `PaymentRouter::refund_payment` refunded the **full amount** while the fee stayed pooled, so each refund drew the fee out of other merchants' funds.                         | P0       |
| S4  | `UpgradeManager::transfer_admin` compared against a non-existent `Address::zero()`, so the "reject zero address" guard never ran (and the crate did not compile).            | P0       |
| S5  | `PriceOracle::get_authorized_oracles` generated _random_ addresses to look them up — an implementation that could never return real data.                                    | P1       |
| S6  | `Governance::check_quorum` compared an unweighted vote **count** against a threshold derived from **weighted** participation; no realistic proposal could ever reach quorum. | P1       |
| S7  | `PriceOracle::convert` omitted the base asset's decimals, making every conversion wrong by a factor of 10^base_decimals.                                                     | P1       |
| S8  | Panic messages used a non-ASCII em dash, which the host escapes in logs and `should_panic` cannot match.                                                                     | P2       |

## 9. CI weaknesses (pre-fix)

- `cargo clippy -- -D warnings` and `cargo test` were both run against a
  workspace that could not compile, i.e. the contract job could never have been
  green.
- No formatting gate for TypeScript (`pnpm format:check` was never run).
- `pnpm audit` used `continue-on-error: true`.
- No local parity command — developers could not reproduce CI.
- `turbo test` depended on each package's own `build`, which made `pnpm test`
  launch `expo export` for the mobile app and never terminate.
- Coverage thresholds absent (see §6).

## 10. Deployment weaknesses

- Helm and raw manifests were consistent, and CI already gated drift.
- Production values correctly refuse to render without pinned digests.
- No image signing/provenance (SBOM generation exists in `supply-chain.yml`).

## 11. Observability gaps

- Metrics and alert rules exist, but webhook delivery had no metrics at all
  (it also had no deliveries). Added during this work: `webhook_delivered_total`,
  `webhook_delivery_failures_total`, `webhook_dead_lettered_total`,
  `webhook_dispatch_pass_duration_seconds`, `webhook_dispatch_backlog`.
- Indexer lag is defined in the alert rules but the indexer exposes no metrics
  endpoint of its own.

## 12. Reliability gaps

- Indexer: no tests for crash recovery or duplicate suppression.
- Webhooks: no retry scheduling (nothing ran the retry schedule).
- JSON/Redis-backed queue config exists but no queue is used by the API.

## 13. Contract risks (pre-fix, resolved in this work)

- Unauthenticated value-moving entrypoints (S1, S2).
- Refund accounting error (S3).
- Four crates could not be built, let alone deployed or audited.
- `#[contracttype]` enums with named fields and `Vec<u8>` fields used where the
  SDK only supports tuple variants and `Bytes`.

## 14. Backend risks

- JWT/API-key auth, Helmet, CORS and throttling are present and configured.
- Error responses do not leak stack traces in production mode.
- The webhook path was the significant hole (§4).

## 15. Indexer risks

- Largest untested surface in the repository (§5).
- `historical.ts` had a swallowing `catch`; malformed-event handling is unproven.

## 16. Database risks

- Prisma 7 compatibility was broken outright (§18.1).
- Schema-level uniqueness/idempotency constraints exist for key tables; needs a
  dedicated review pass (see remaining gaps in the final report).

## 17. Frontend risks

- Dashboards have no tests.
- Admin-only capabilities are route-guarded; no test proves it.

## 18. Exact fixes applied (highest priority first)

### 18.1 Prisma 7 (P0)

- Added `@prisma/adapter-pg` pinned to `7.9.1`, matching the Prisma client.
- Added `packages/database/prisma.config.ts` with an explicit `dotenv` load
  (Prisma 7 no longer auto-loads `.env`) and a path resolved relative to the
  package, not the process cwd.
- `packages/database/src/index.ts` now constructs the client with the adapter.
- `apps/api/src/database/prisma.service.ts` uses the same construction path.

Verified: `cd packages/database && npx prisma migrate deploy` reaches Postgres
(only fails with `P1001` when no server is listening, which is expected).

### 18.2 Jest ESM (P0)

`apps/api/jest.config.js` now transforms the five ESM-only packages reachable
from `@stellar/stellar-sdk` — `@stellar/stellar-sdk`, `@exodus/bytes`,
`@noble/ed25519`, `@noble/hashes`, `is-retry-allowed`, `uint8array-extras` —
including the pnpm layout, where packages live under
`node_modules/.pnpm/<name>@<version>/node_modules/`.

Verified: 19 suites / 136 tests pass.

### 18.3 ESLint flat config (P0)

- Replaced `.eslintrc.js` (root + 2 app overrides) with `eslint.config.mjs`.
- `eslint-plugin-import` was replaced with the maintained `eslint-plugin-import-x`
  fork, which supports ESLint 10.
- TypeScript is aliased to `@typescript/typescript6` for the linter only, because
  `typescript-eslint@8` hard-throws on TypeScript 7. Builds still use TS 7.
- Per-package `tsconfig.typecheck.json` files were added and are used by both
  ESLint and `pnpm typecheck`, so test/seed/example files are now checked.

Verified: `pnpm lint` → 22/22 tasks, 0 errors.

### 18.4 API typecheck (P0)

- Fixed `PrismaService` mock typing centrally (`test/mocks/prisma.mock.ts`) so
  `jest.Mocked<PrismaService>` mocks delegates that are getters.
- Fixed stale spec fixtures that used a `currency` field the DTO does not have
  (the API uses `assetCode`/`assetIssuer`).
- Added `apps/api/tsconfig.typecheck.json` covering `src`, `test` and specs.

Verified: `tsc -p tsconfig.typecheck.json` → clean, 0 errors.

### 18.5 PaymentRouter (P0)

- `create_payment` now requires authorization from the payer and rejects a
  payment that names someone else as payer.
- `confirm_payment` requires merchant authorization and is idempotent.
- `refund_payment` refunds **amount − fee**, so the fee retained at confirmation
  is returned too and pooled fees are never silently drained.
- Emergency pause is enforced on value movement.
- Regression tests added for each of the above.

### 18.6 Webhook delivery (P0)

- Added `WebhookDispatchScheduler`, which invokes the existing
  `WebhookDispatcherService.processDue()` on an interval.
- `processDue()` now claims deliveries atomically, so multiple API replicas
  cannot double-send.
- Added webhook metrics and a Prometheus alert for dead-lettered deliveries.
- Added `webhook-dispatcher.service.spec.ts` and
  `webhook-dispatch.scheduler.spec.ts` (23 tests).

### 18.7 Contracts (P0)

- Added the missing `testutils` dev-dependency to 11 crates and removed the
  non-existent `std` feature from 4 manifests.
- Fixed `UpgradeManager` (`Bytes` instead of `Vec<u8>`; struct instead of an enum
  with named fields; `symbol_short!` names within the 9-character limit;
  removed the impossible `Address::zero()` check).
- Fixed `PriceOracle` (string concatenation without `push`/`push_str`, an oracle
  index that can actually be enumerated, and correct decimal handling in
  `convert`).
- Fixed `Governance` (`Vec` construction, `symbol_short!` limits, quorum math).
- Fixed `ImpactNFT` (contract-argument limit reached by an 11-argument method;
  replaced with a `BadgeDefinitionInput` struct).
- Replaced the em-dash panic message with ASCII so it survives host escaping.
- Reduced fuzz iteration counts and raised the test budget
  (`env.budget().reset_unlimited()`), so the funds-at-risk suites both run and
  actually terminate.
- Rewrote every broken suite so it compiles and asserts real contract behaviour.

Verified: 272 tests pass; `cargo clippy --all-targets -- -D warnings` clean;
`cargo fmt --check` clean; all 16 contracts build to `wasm32-unknown-unknown`.

### 18.8 Tooling and CI (P1)

- `turbo.json`: `test`/`test:coverage` now depend on `^build`, not `build`, so
  `pnpm test` no longer launches `expo export` and hang.
- Added `.prettierignore` (Helm templates are not valid YAML and cannot be
  formatted by Prettier; `helm lint` validates them instead).
- Added `scripts/ci-local.sh` and the `pnpm ci` / `pnpm ci:quick` scripts, which
  run the same stages CI runs and report any stage that could not be executed.
- Ran `prettier --write` across the repository so `pnpm format:check` is a real
  gate.

---

## 19. Recommended next fixes (not completed in that pass)

Priority-ordered, with the gap stated precisely. The status column records what
had happened by 2026-09-15.

| Priority | Item                                                                                                                         | Status (2026-09-15)                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| P1       | Write indexer tests: checkpoint recovery, duplicate-event suppression, malformed events, exponential backoff, crash/restart. | **Done** — 114 tests, floors enforced, 96% lines                                     |
| P1       | Add coverage thresholds (API 80% lines, 90% for payment/refund/settlement/auth) and enable `--coverage` in CI.               | **Partial** — floors in 4 packages; the 80%/90% targets are not met (API ~52% lines) |
| P1       | Remove `--passWithNoTests` from the packages that have no tests, or write the tests; the flag currently hides the gap.       | **Done** — no test script uses it                                                    |
| P1       | Wire `tests/e2e` into CI against a containerised stack.                                                                      | **Done** — `e2e` job; 36/36 pass, no containerised stack needed                      |
| P2       | Add API-level idempotency tests proving retries cannot duplicate payments/refunds/settlements.                               | Open                                                                                 |
| P2       | Indexer should expose `/metrics` so the existing alert rules have data.                                                      | **Done** — `/metrics`, `/health`, `/ready` on 4100                                   |
| P2       | Container scanning (Trivy) and SBOM publication per image in CI.                                                             | **Already present** — `supply-chain.yml`                                             |
| P2       | Add tests for the three dashboards (auth guard, role-based routes).                                                          | **Done** — session/route-guard specs in all three                                    |
| P2       | Make `pnpm audit` blocking once the current advisory set is triaged.                                                         | Open — still `continue-on-error` in `ci.yml`                                         |
| P3       | Remove or adopt the unused `packages/ui` and `packages/hooks` code.                                                          | Open                                                                                 |
| P3       | Add image signing / provenance attestation to the release workflow.                                                          | **Already present** — cosign keyless on tags in `supply-chain.yml`                   |
| P3       | Document every environment variable in one place and validate with `packages/config`.                                        | Open                                                                                 |
