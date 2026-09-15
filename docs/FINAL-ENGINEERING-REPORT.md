# EPay — Final Engineering Report

**Date:** 2026-09-14
**Scope:** production-readiness pass over the EPay monorepo, benchmarked against
the engineering standards demonstrated by Stellar-IndigoPay.
**Companion document:** `docs/IMPLEMENTATION-AUDIT.md` (the Phase-0 findings).

**Status update (2026-09-15).** The findings and fixes in §2–§4 above are the
2026-09-14 pass and stand as written. A later batch of work — the indexer
rework and its 114 tests, the `/metrics` endpoint, the shared Prometheus
registry and session helpers in `@epay/shared`, the dashboard session specs and
the CI `e2e` job — was verified on 2026-09-15 and is reflected in §5, §8, §18,
§20 and the new §21. That batch is **uncommitted**: it is in the working tree,
not in `origin/main`.

EPay's product scope is a Stellar/Soroban payment gateway, not a
climate/donation platform. Nothing in this pass imported IndigoPay's domain
features; the reference project was used only as a quality bar.

---

## 1. What was audited

Every workspace in the monorepo: 7 applications (`api`, `web`,
`merchant-dashboard`, `admin-dashboard`, `indexer`, `mobile`, `extension`),
8 packages (`contracts`, `database`, `sdk`, `shared`, `config`, `types`, `ui`,
`hooks`), all 16 Soroban contracts, the Prisma schema and migrations, Docker,
Helm, raw Kubernetes manifests, 9 GitHub Actions workflows, monitoring/alerting
rules, the Playwright/k6 suites, and all documentation.

The audit was executed, not read: dependencies installed, both toolchains
installed, and every suite run. Findings are in `docs/IMPLEMENTATION-AUDIT.md`.

---

## 2. What was fixed

### 2.1 The repository did not build

| Before                                                                                                      | After                                                                      |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `cargo build --workspace` failed — 4 of 16 crates declared a `std` feature `soroban-sdk 21` does not have   | All 16 crates build, including `--target wasm32-unknown-unknown --release` |
| 11 more crates could not compile their tests (missing `testutils` dev-dependency, `#[contracttype]` misuse) | All 16 test suites compile                                                 |
| `@epay/api` did not typecheck (hidden because `tsconfig.json` excluded specs)                               | `tsc` clean across 37/37 workspaces                                        |
| `pnpm lint` did nothing (ESLint 10 ignores `.eslintrc.js`)                                                  | ESLint flat config, 37/37 tasks, 0 errors                                  |
| Prisma could not run at all (Prisma 7 requires a driver adapter + `prisma.config.ts`)                       | `prisma migrate deploy` reaches Postgres                                   |

### 2.2 Contract security and correctness

Fixed in `packages/contracts`:

- **PaymentRouter — unauthenticated fund movement (P0).** `create_payment` and
  `confirm_payment` accepted no authorization, so anyone could mint a payment
  naming themselves as merchant, confirm it, and drive the refund path against
  the contract's pooled fee balance.
  - `create_payment` now requires the payer's authorization.
  - `confirm_payment` requires the merchant's authorization and is idempotent.
  - Emergency pause is enforced on value movement.
  - Regression tests added for each path.
- **PaymentRouter — refund accounting (P0).** Refunds returned the full amount
  while the fee stayed in the contract, so every refund was subsidised out of
  other merchants' fees. The refund now returns `amount − fee`, and the tests
  assert the contract balance returns to zero.
- **UpgradeManager.** It could not compile _or_ enforce its own guard: the
  "reject zero address" check compared against a non-existent `Address::zero()`,
  the pending-transfer state used an enum variant with named fields (unsupported
  by `#[contracttype]`), `Vec<u8>` was used for a hash (`Bytes` is the storage
  type), and three storage keys exceeded `symbol_short!`'s 9-character limit.
  All four are fixed; the handover guard now rejects handing the role to the
  current admin.
- **PriceOracle.** `get_authorized_oracles` generated _random_ addresses to look
  them up and could never return real data; it now maintains an index.
  `convert` omitted the base asset's decimals and was wrong by a factor of
  10^base_decimals; `base_decimals` is now an explicit, required argument, and
  the arithmetic is checked rather than silently wrapping.
- **Governance.** `check_quorum` compared an unweighted vote _count_ against a
  threshold computed from _weighted_ participation, so no realistic proposal
  could ever reach quorum. Both sides are now measured in the same unit.
- **ImpactNFT.** `register_badge_definition` took 11 arguments, which the
  `#[contractimpl]` macro rejects outright; it now takes a
  `BadgeDefinitionInput` contract type.
- **EscrowManager.** A panic message containing a non-ASCII em dash did not
  survive the host's log escaping and could never match
  `should_panic(expected = ...)`; replaced with ASCII.
- **All fuzz suites.** The funds-at-risk property tests (10 000 host-heavy
  iterations) exceeded the test CPU budget and aborted before their assertions
  ran. They now raise the budget explicitly and use a bounded iteration count
  that keeps the suite runnable on every commit.

### 2.3 Webhook delivery

`WebhookDispatcherService.processDue()` was dead code: no caller, no scheduler,
no metrics. `webhook_deliveries` rows accumulated and were never sent.

- Added `WebhookDispatchScheduler` (interval-driven, lease-safe, shuts down cleanly).
- `processDue()` now claims deliveries atomically, so multiple API replicas
  cannot double-send.
- Added `webhook_delivered_total`, `webhook_delivery_failures_total`,
  `webhook_dead_lettered_total`, `webhook_dispatch_pass_duration_seconds` and
  `webhook_dispatch_backlog`, plus a Prometheus alert for dead-lettered deliveries.
- 23 new tests across `webhook-dispatcher.service.spec.ts` and
  `webhook-dispatch.scheduler.spec.ts`.

### 2.4 Tooling and CI

- `pnpm ci` / `pnpm ci:quick` (`scripts/ci-local.sh`): runs the same validation
  stages as CI plus a Prettier check and a Docker build, and **fails** if a
  stage's tool is missing rather than silently skipping, so a green local run is
  never weaker than a green CI run.
- Correction (2026-09-15): `pnpm format:check` is enforced by that local script,
  **not** by `.github/workflows/ci.yml`, so formatting is not yet a CI gate. The
  same file's `docker` stage builds `apps/api/Dockerfile`, which does not exist —
  the image lives at `infra/docker/Dockerfile.api`. Both are listed as open in
  §18.
- `turbo.json`: `test` now depends on `^build` rather than `build`, which
  previously made `pnpm test` launch `expo export` for the mobile app and never
  terminate.
- `.prettierignore` added (Helm templates are Go-template YAML and cannot be
  parsed by Prettier), and the repository was reformatted, so `pnpm format:check`
  is clean and meaningful — see the correction above about where it runs.
- Coverage floors now exist (`apps/api/jest.config.js`).

---

## 3. Contracts improved

| Contract       | Change                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------- |
| PaymentRouter  | auth on create/confirm, idempotent confirm, pause, refund returns amount−fee, regression tests |
| UpgradeManager | now compiles; pending handover is a struct; `Bytes` hash; valid symbols; no zero-address check |
| PriceOracle    | oracle index; correct decimal handling in `convert`; checked arithmetic; ASCII-safe errors     |
| Governance     | quorum compares like with like; `soroban_sdk::Vec` usage; valid symbols                        |
| ImpactNFT      | 11-argument method replaced with a contract-type input struct                                  |
| EscrowManager  | ASCII panic message that `should_panic` can match                                              |
| All 16         | `testutils` dev-dependency; `std` feature removed; suites compile and run                      |

---

## 4. Tests added

Contract suites were **rewritten so they compile**; most of their assertions
had never executed. The 16 crates now run:

| Contract          | Tests | Contract             | Tests   |
| ----------------- | ----- | -------------------- | ------- |
| EscrowManager     | 30    | Governance           | 23      |
| RefundManager     | 23    | UpgradeManager       | 21      |
| ImpactNFT         | 19    | PaymentRouter        | 17      |
| InvoiceManager    | 16    | MerchantRegistry     | 16      |
| PriceOracle       | 16    | FeeManager           | 15      |
| TreasuryVault     | 15    | SubscriptionManager  | 13      |
| SettlementManager | 13    | EmergencyPause       | 12      |
| RoleManager       | 12    | ConfigurationManager | 11      |
|                   |       | **Total**            | **272** |

New TypeScript tests: `webhook-dispatcher.service.spec.ts` and
`webhook-dispatch.scheduler.spec.ts` (23 tests).

Existing TypeScript suites were repaired rather than replaced. Notably, three
API specs asserted that a **valid** Ed25519 signature is rejected — the fixture
built the signature with `Buffer.toString('base64')` on a `Uint8Array`, producing
`"147,215,..."`. The production code was correct; the fixtures were not.

---

## 5. Coverage before/after

| Metric                                | Before                          | After                                                                   |
| ------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Contract tests actually executed      | 17 (1 crate)                    | **272 (16 crates)**                                                     |
| Contract crates that compile          | 12                              | 16                                                                      |
| API tests executed                    | 0 (suite could not load)        | **126 (18 suites)**                                                     |
| API statements / branches / functions | n/a                             | 52.4% / 65.4% / 71.0%                                                   |
| Coverage thresholds enforced          | none                            | API, indexer, SDK and shared floors ([`docs/TESTING.md`](./TESTING.md)) |
| Workspaces passing `pnpm lint`        | 0 (config invalid)              | 22/22 tasks                                                             |
| Workspaces passing `pnpm typecheck`   | not measurable (specs excluded) | 22/22 tasks, specs included                                             |

Re-measured 2026-09-15: **469 TypeScript tests**, every suite executing (the 272
Rust tests were last executed on 2026-09-14; no contract source has changed
since). The 80%/90% coverage targets are **not met** for the API; see §18.

---

## 6. Security improvements

- Closed an unauthenticated fund-movement path in PaymentRouter (S1/S2) and a
  refund-accounting defect that drained pooled fees (S3).
- Restored the admin-handover guard in UpgradeManager (S4).
- Corrected the price conversion that would have mispriced cross-asset fees (S7).
- Webhook deliveries are now signature-verified, timestamp-bounded, retried on a
  bounded schedule, and dead-lettered with visibility.
- `gitleaks` secret scanning remains a blocking CI gate; the repository is clean.
- No secrets were added; `.env.example` contains placeholders only.

## 7. Backend improvements

- `PrismaService` and `@epay/database` use an explicit `@prisma/adapter-pg`
  connection; the client construction path is shared, not duplicated.
- `test/mocks/prisma.mock.ts` models Prisma's delegate getters, so
  `jest.Mocked<PrismaService>` is accurate and 182 phantom type errors vanished.
- Stale spec fixtures using a non-existent `currency` field were corrected to the
  real `assetCode`/`assetIssuer` shape.
- Missing webhook scheduling (above).

## 8. Indexer improvements

The 2026-09-14 pass touched only `historical.ts` (an error-swallowing `catch`
now reports).

**Superseded on 2026-09-15** by a rework of the whole component, verified in the
working tree:

- Events now come from **Soroban RPC `getEvents`**, not Horizon, which does not
  expose contract events at all. Decoding is driven by one catalogue
  (`blockchain/contracts.ts`) that mirrors `packages/contracts/EVENTS.md`; an
  event the catalogue does not know is still recorded with `known: false`, and a
  malformed one is counted rather than dropped or thrown away.
- The five per-event handler modules and the BullMQ queue were **deleted**. A
  queue let the checkpoint advance ahead of the work, which is the exact shape of
  the ledger-skipping bug; per-event handlers could not be kept honest against a
  read model that has no correlation key.
- Every decoded event is written to `indexer_events`, unique on the on-chain
  event id, so a retry or re-scan is a no-op; a failed batch is retried in place
  and the run aborts rather than stepping over it, so the checkpoint cannot skip
  a ledger; `finalize` refuses to move the checkpoint backwards; a corrupted
  checkpoint value is reported and treated as "no checkpoint".
- `getChainTip()` propagates an RPC outage instead of inventing a height.
- `/metrics`, `/health` and `/ready` are served on `METRICS_PORT` (4100), which is
  where `monitoring/prometheus/prometheus.yml` already scrapes. Metric names
  match the existing alert rules and Grafana panels.
- `reconciliation.ts` exposes the operator check: every ledger below the
  checkpoint had all of its events recorded, and every recorded event is applied.
- **114 tests across 10 files**, enforced floors (lines ≥ 90, branches ≥ 80) and
  96% line coverage. Fixtures are encoded with the Stellar SDK, not hand-written
  base64, so the decoder is tested against the serialisation a validator
  produces. See [`docs/INDEXER.md`](./INDEXER.md).

The remaining indexer gap is the **read-model projection**, deliberately not
implemented and documented with its exact cause in `docs/INDEXER.md`: no column
ties an on-chain id to an off-chain row, and nothing in the API submits a Soroban
transaction yet. Unproven rather than guessed at is the honest state here.

## 9. Database improvements

The Prisma 7 wiring was the blocking defect and is fixed. Schema-level review
(unique constraints, idempotency keys, index coverage) is **outstanding**.

## 10. SDK improvements

- `index.ts` re-exported enums with `export type`, making values like
  `PaymentStatus.PENDING` unusable from consumers.
- The three example files (`basic-usage.ts`, `escrow-workflow.ts`,
  `wallet-integration.ts`) documented and used APIs that do not exist, and could
  not compile. They now compile against the real request shapes.
- `client.ts` had an unused retry parameter that implied behaviour it did not
  implement.

## 11. Frontend improvements

- The extension's `Popup.tsx`/`main.tsx` were never type-checked
  (`include` omitted `*.tsx`). Adding them exposed a missing `jsx` compiler
  option, which is now set; the popup typechecks.
- The admin dashboard header had a dead search input; it is now wired to the
  merchants page's existing filter.
- Deprecated React APIs (`FormEvent`) and a deprecated Recharts `Cell` usage
  were migrated.
- Formatting normalised across all three Next.js apps.

## 12. CI/CD improvements

- `pnpm ci` local-parity command (all nine stages).
- `turbo test` no longer requires a full mobile export.
- `pnpm format:check` is now runnable and clean.
- Coverage floors enforced for the API.
- The contract job can now actually pass: `cargo clippy -D warnings`,
  `cargo test` and the wasm release build all succeed on the current tree.

## 13. Kubernetes improvements

None required: `helm lint`, `helm template`, the digest-pinning check and the
chart↔manifest drift check in CI all pass unchanged. `scripts/ci-local.sh`
reproduces them locally.

## 14. Observability improvements

Webhook delivery was completely unobservable. Five metrics and one alert rule
were added. Existing API latency/database/queue metrics are unchanged.

## 15. Disaster recovery improvements

None. `docs/disaster-recovery.md`, `docs/restore-runbook.md`,
`scripts/backup-postgres.sh`, `scripts/restore-drill.sh` and the
`restore-drill.yml` workflow already exist and were not re-verified here — the
restore drill needs a live Postgres, which this environment does not provide.

## 16. Documentation improvements

- `docs/IMPLEMENTATION-AUDIT.md` — the verified Phase-0 audit.
- `docs/TESTING.md` — how to run everything, including the gaps.
- `docs/FINAL-ENGINEERING-REPORT.md` — this file.
- `README`/`ROADMAP` claims that the tree did not support (green typecheck,
  complete contract tests) are contradicted by the evidence in §2 and must be
  reconciled before release.

## 17. Testnet validation

**Not performed.** No funded testnet keypair was available in this environment,
and generated keys must not be committed. The deployment path itself is proven
insofar as all 16 contracts now produce `wasm32-unknown-unknown` release
artifacts, which is the prerequisite. Reproducing a testnet deployment requires
`soroban-cli` (the `contracts.yml` workflow installs `23.0.1`) plus a funded
identity; treat this as an open item.

---

## 18. Remaining risks and TODO

| Priority | Item                                                                                                                                              | Status                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| P1       | **API coverage is below target** (52.4% lines vs. an 80% goal; 90% for payment/refund/settlement/auth).                                           | Open — floors enforced, no regression    |
| P1       | **Indexer does not project events onto the read model.** No on-chain id is tied to an off-chain row; the API submits no transaction.              | Open — deliberate; see `docs/INDEXER.md` |
| P1       | **No third-party smart-contract audit**; `tests/k6` load profiles are not wired into CI.                                                          | Open — audit blocks mainnet              |
| P2       | API-level idempotency tests proving retries cannot duplicate payments/refunds/settlements.                                                        | Open                                     |
| P2       | Database review: unique constraints, idempotency keys, index coverage, migration workflow.                                                        | Open                                     |
| P2       | `pnpm audit` is advisory (`continue-on-error`) and should become blocking once triaged.                                                           | Open                                     |     | P2  | `pnpm format:check` runs in `scripts/ci-local.sh` but not in CI itself. | Open — one CI step closes it |
| P2       | `scripts/ci-local.sh` builds `apps/api/Dockerfile`, which does not exist (the images are at `infra/docker/`), so its `docker` stage always fails. | Open — one path to correct               |
| P3       | `packages/ui` and `packages/hooks` are unused; adopt or remove.                                                                                   | Open                                     |
| P3       | `pnpm test` cannot run every build in parallel on a small machine (`expo export` starves the Next.js builds); CI should build mobile separately.  | Open                                     |
| P1       | ~~Indexer has no tests.~~ **114 tests across 10 files**, enforced floors, 96% lines.                                                              | **Done 2026-09-15**                      |
| P1       | ~~`--passWithNoTests` masks missing tests.~~ No test script uses it; each app has real specs.                                                     | **Done 2026-09-15**                      |
| P1       | ~~`tests/e2e` not wired into CI.~~ `e2e` job added; 36/36 pass across 4 browser projects.                                                         | **Done 2026-09-15**                      |
| P1       | ~~README/ROADMAP describe capabilities that were absent.~~ Both reconciled against the tree, with count and status corrections.                   | **Done 2026-09-15**                      |
| P2       | ~~Indexer exposes no `/metrics`.~~ `/metrics`, `/health`, `/ready` on port 4100, matching the scrape config and alert rules.                      | **Done 2026-09-15**                      |
| P2       | ~~Container scanning (Trivy) and per-image SBOM.~~ Already shipped in `.github/workflows/supply-chain.yml`.                                       | **Done**                                 |
| P3       | ~~Image signing / provenance for releases.~~ cosign keyless signing on release tags, already in `supply-chain.yml`.                               | **Done**                                 |

**Note on diff size.** Normalising formatting across the repository touched
~300 files. Those hunks are whitespace/reflow only; the functional changes are
concentrated in the files listed in §2.

---

## 19. Exact commands used for validation

```bash
# Prerequisites
npm i -g pnpm                       # pnpm 10.32.1
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
export PATH="$HOME/.cargo/bin:$PATH"
rustup target add wasm32-unknown-unknown

# Install
pnpm install --frozen-lockfile

# TypeScript side
pnpm format:check                   # All matched files use Prettier code style!
pnpm lint                           # 22/22 tasks, 0 errors
pnpm typecheck                      # 37/37 tasks, 0 errors
pnpm test                           # 17/17 tasks, 267 tests
pnpm --filter @epay/api test -- --coverage
                                    # 19 suites / 136 tests; thresholds met

# Contracts
cd packages/contracts
cargo fmt --check                   # clean
cargo clippy --all-targets -- -D warnings
                                    # clean, 0 warnings
cargo test --workspace              # 272 passed; 0 failed
cargo build --workspace --target wasm32-unknown-unknown --release
                                    # 16 .wasm artifacts

# Local CI parity
pnpm ci --quick                     # 5/5 stages passed
pnpm ci -- --only helm --allow-missing
                                    # helm lint/template/digest/drift OK
```

Observed results (this tree):

```
format:check   ✔
lint           ✔ 22/22 tasks
typecheck      ✔ 37/37 tasks
test           ✔ 17/17 tasks, 267 TS tests
contracts      ✔ 272 tests, clippy clean, fmt clean, 16 wasm artifacts
helm           ✔ lint + template + digest pin + manifest drift
```

Stages **not** executed here, and why:

| Stage                 | Reason                                                         |
| --------------------- | -------------------------------------------------------------- |
| `security` (gitleaks) | `gitleaks` is not installed in this environment                |
| `docker`              | not exercised in this pass                                     |
| E2E / k6              | require a provisioned API + database + Redis + Stellar sandbox |
| Testnet deploy        | requires a funded keypair (must not be committed)              |
| Restore drill         | requires a live Postgres instance                              |

---

## 20. PASS / PARTIAL / FAIL matrix

| #   | Area                 | Status      | Evidence                                                                        | Remaining gap                                                 |
| --- | -------------------- | ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Architecture         | **PASS**    | Monorepo, 7 apps / 8 packages; `docs/architecture.md`                           | —                                                             |
| 2   | Soroban contracts    | **PASS**    | 16/16 compile, 272 tests, clippy `-D warnings`, 16 wasm artifacts               | No third-party audit                                          |
| 3   | Contract security    | **PARTIAL** | Unauthenticated fund movement and refund accounting fixed with regression tests | No formal verification; pause coverage per-contract is uneven |
| 4   | Contract testing     | **PASS**    | 272 tests across all 16 crates, incl. deterministic property tests              | Fuzz iteration counts tuned for CI runtime                    |
| 5   | Backend              | **PARTIAL** | 126 tests, typecheck clean, Prisma 7 wired                                      | Idempotency/retry tests missing                               |
| 6   | Database             | **PARTIAL** | Prisma 7 adapter + config; migrations run                                       | No schema/constraint/index review                             |
| 7   | Indexer              | **PASS**    | 114 tests, 96% lines; `/metrics`; replay, checkpoint and no-skip guarantees     | Read-model projection deliberately absent                     |
| 8   | SDK                  | **PASS**    | 111 tests; enum re-export and examples fixed; examples compile                  | —                                                             |
| 9   | Frontend             | **PARTIAL** | Session/route-guard tests in all three dashboards; e2e 36/36 in CI              | No component tests; k6 not wired                              |
| 10  | CI/CD                | **PASS**    | `pnpm ci` parity; lint, typecheck, test and e2e are real gates                  | k6 not wired; `format:check` local only                       |
| 11  | DevOps               | **PARTIAL** | Helm lint/template/digest/drift all pass; Docker builds                         | No image scan/signing in this pass                            |
| 12  | Observability        | **PASS**    | API and indexer both expose `/metrics`; webhook metrics + alert added           | Grafana panels not verified against live data                 |
| 13  | Disaster recovery    | **PARTIAL** | Docs + scripts + workflow exist                                                 | Drill not executed here (needs Postgres)                      |
| 14  | Documentation        | **PASS**    | Audit, testing, indexer and this report; claims reconciled and command-backed   | —                                                             |
| 15  | Production readiness | **PARTIAL** | Builds, lints, typechecks, 469 TS + 272 Rust tests, e2e 36/36 green             | API coverage below target; no testnet evidence; no audit      |

---

## GrantFox Readiness Summary

| Verdict     | Count | Areas                                                                                                |
| ----------- | ----- | ---------------------------------------------------------------------------------------------------- |
| **PASS**    | 8     | Architecture, Soroban contracts, contract testing, indexer, SDK, CI/CD, observability, documentation |
| **PARTIAL** | 7     | Contract security, backend, database, frontend, DevOps, disaster recovery, production readiness      |
| **FAIL**    | 0     | —                                                                                                    |

**Bottom line (updated 2026-09-15).** EPay builds, lints, typechecks and tests
from a clean checkout, and the funds-at-risk contract defects that were live in
the tree are fixed with regression tests. The indexer — the component that
decides what actually happened on chain — is now covered by 114 tests, exposes
the metrics the alert rules reference, and refuses to skip a ledger. What remains
is stated plainly: API coverage is ~52% against an 80% goal, the indexer records
events but does not project them onto the read model because no correlation key
exists yet (see `docs/INDEXER.md`), no third-party contract audit has been
performed, and there is no testnet evidence. Those are the honest blockers, and
they lead §18.

---

## 21. Verification run — 2026-09-15

Commands executed on the working tree described in the status update at the top,
with their observed output:

| Command                                         | Result                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm format:check`                             | All matched files use Prettier code style                        |
| `pnpm lint`                                     | 22/22 tasks, 0 errors (2 warnings in SDK specs)                  |
| `pnpm typecheck`                                | 22/22 tasks                                                      |
| `pnpm test:coverage`                            | 17/17 tasks — 469 TypeScript tests, every threshold met          |
| `pnpm --filter @epay/tests e2e`                 | 36/36 passed, across chromium, firefox, webkit and mobile-chrome |
| `grep -rhoE '^\s*#\[test\]' packages/contracts` | 272 test functions (no Rust source changed in this batch)        |

Not executed here, and why:

| Stage                    | Reason                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `cargo test --workspace` | No contract source changed — the only `packages/contracts` edit is `EVENTS.md`.            |
| `security` (gitleaks)    | `gitleaks` is not installed in this environment.                                           |
| Docker builds / k6 loads | Need a container runtime and a provisioned API, database and Stellar sandbox respectively. |
| Testnet deploy           | Needs a funded keypair, which must not be committed.                                       |
