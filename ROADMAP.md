# EPay Roadmap

**How to read this document.** `Shipped` means the code is merged to `main` and
passes CI. `In Progress` means there is an open pull request with a verified
working tree — not a promise, not a design sketch. `Planned` means scoped but not
started. Nothing is listed as `Shipped` unless it is in `main`.

Last reviewed: 2026-09-15.

**Working tree status.** Part of what is described below exists only as
_uncommitted_ changes on a local `main`, not on `origin/main`: the indexer
rework and its tests, the `/metrics` endpoint, the shared Prometheus registry and
session helpers in `@epay/shared`, the dashboard session specs, and the
Playwright `e2e` job. Nothing in that batch is listed as `Shipped`, because
`Shipped` means merged to `main` and passing CI.

---

## ✅ Shipped

### Smart contracts

- **16 Soroban contracts.** The 12 payment primitives (`PaymentRouter`,
  `InvoiceManager`, `EscrowManager`, `RefundManager`, `SubscriptionManager`,
  `SettlementManager`, `MerchantRegistry`, `TreasuryVault`, `FeeManager`,
  `ConfigurationManager`, `EmergencyPause`, `RoleManager`) plus `UpgradeManager`,
  `PriceOracle`, `Governance`, and `ImpactNFT`.
- **Trust hardening — done.**
  - Two-step admin transfer: `transfer_admin` → `accept_admin`
    (`UpgradeManager`), with cancellation by the sitting admin.
  - **72-hour timelock** on `propose_upgrade` → `execute_upgrade`.
  - `EmergencyPause` with `require_not_paused()` for downstream gating.
  - Recorded in [ADR 0004](./docs/adr/0004-upgrade-pattern.md).
- **Test coverage.** 272 Rust `#[test]` functions across all 16 suites, including
  **10,000-iteration property/fuzz suites** for the four funds-at-risk contracts
  (`TreasuryVault`, `EscrowManager`, `RefundManager`, `SettlementManager`),
  asserting conservation-of-funds and state-machine invariants.
- **Documentation.** Per-contract entry points, access control, and invariants
  ([`packages/contracts/README.md`](./packages/contracts/README.md)); ownership,
  upgrade, and pause model ([`packages/contracts/SECURITY.md`](./packages/contracts/SECURITY.md));
  and every emitted event ([`packages/contracts/EVENTS.md`](./packages/contracts/EVENTS.md)).
- Deployed to Stellar testnet with addresses in [DEPLOYMENTS.md](./DEPLOYMENTS.md).

### Backend

- NestJS + Fastify API with 17 feature modules; JWT,
  API key, and wallet-signature auth; global throttling; Swagger at `/api/docs`;
  helmet with a Content-Security-Policy.
- **Observability.** `GET /metrics` in Prometheus exposition format
  (`epay_http_requests_total`, latency histograms, DB pool/query timing, queue
  depth, AI tokens), bearer-token gated in production; request-ID correlation via
  `AsyncLocalStorage`; Sentry-compatible error reporting over the wire protocol
  (no SDK dependency).
- **Webhooks.** HMAC-SHA256 signing (`X-EPay-Signature: t=…,v1=…`), a
  30s/2m/10m/30m/2h/6h retry schedule, dead-lettering after the last attempt,
  and per-`(merchant, eventId)` idempotency. Receiver contract documented in
  [`docs/webhook-receiver.md`](./docs/webhook-receiver.md).
- **Audit log.** `AuditLog` records actor, action, resource, IP, and user agent
  for admin actions across all three dashboards.
- Indexer: an untested Horizon-based scanner with one handler per event type and
  a BullMQ queue between decoding and checkpointing. Superseded — see _In
  Progress_ and [`docs/INDEXER.md`](./docs/INDEXER.md).

### Frontends & SDK

- Customer web app, merchant dashboard, and admin dashboard (Next.js 15 /
  React 19), deployed to Vercel. See
  [ADR 0006](./docs/adr/0006-dashboard-decomposition.md) for why three apps.
- TypeScript SDK: `EPayClient`, `WalletClient`, 9 resource modules, Stellar
  helpers, 111 tests.
- Prisma schema with 23 models and a seed script. See
  [ADR 0002](./docs/adr/0002-custody-model.md) for the read-model design.

### Operations

- **Observability stack.** [`monitoring/`](./monitoring/) — Prometheus, Grafana
  (four dashboards), Alertmanager (nine alert rules), PagerDuty/Slack routing.
- **Kubernetes & GitOps.** [`helm/epay/`](./helm/epay/) chart (HPA 2–10, PDB,
  default-deny NetworkPolicy, digest-pinning assertion), generated
  [`k8s/manifests.yaml`](./k8s/manifests.yaml) with CI drift check,
  [`gitops/argocd-application.yaml`](./gitops/argocd-application.yaml) with an
  Argo Rollouts canary gated on a Prometheus success-rate analysis, and an
  [External Secrets](./docs/external-secrets.md) template.
- **Disaster recovery.** Nightly `pg_dump` with 30-day retention, a monthly
  restore drill into ephemeral Postgres asserting referential integrity, and
  [RTO/RPO documentation](./docs/disaster-recovery.md) plus a
  [manual restore runbook](./docs/restore-runbook.md).
- **Supply chain.** CycloneDX SBOM per push, Trivy filesystem + image scans,
  cosign keyless signing on release tags, blocking Gitleaks with a curated
  [`.gitleaks.toml`](./.gitleaks.toml).
- **Release automation.** semantic-release derives versions from Conventional
  Commits ([`.releaserc.json`](./.releaserc.json)) and tagging triggers image
  signing.
- **Testing breadth.** Playwright e2e with `@axe-core/playwright` accessibility
  assertions, run in CI as the `e2e` job (9 tests × 4 browser projects, all
  passing); k6 load tests with SLOs in
  [`docs/performance.md`](./docs/performance.md), not yet wired into CI; and an
  OWASP ZAP baseline DAST workflow.

### Documentation

- [`docs/`](./docs/README.md) index with getting started, architecture and
  rationale, integration guide, webhook receiver contract, performance SLOs,
  disaster recovery, external secrets, indexer internals, testing, the audit and
  the engineering report, and six ADRs.

---

## 🚧 In Progress

- **Indexer hardening, shared helpers, and test depth** — verified in the working
  tree, **not merged**. Soroban RPC `getEvents` ingestion with XDR decoding
  driven by one contract/event catalogue; idempotent persistence keyed on the
  on-chain event id; batch retry-in-place with a checkpoint that cannot skip a
  ledger; bounded exponential backoff on the real-time tail; `/metrics`,
  `/health` and `/ready` on `METRICS_PORT` (4100); 114 tests with enforced
  coverage floors. The same batch deletes the per-event handlers and the BullMQ
  queue (the queue could let the checkpoint advance ahead of the work), moves the
  Prometheus registry and the dashboard session/route-guard helpers into
  `@epay/shared`, adds session specs to the three dashboards, and wires
  `tests/e2e` into CI as a real gate. See [`docs/INDEXER.md`](./docs/INDEXER.md).
- **Mobile app (`apps/mobile`)** — Expo SDK 57 / React Native 0.86,
  `expo-router`, QR payment scanning, biometric authorization, secure token
  storage, push receipts, offline-tolerant caching. Typechecks, passes 11 unit
  tests, exports iOS + Android bundles.
- **Browser extension (`apps/extension`)** — Manifest V3 (Chrome + Firefox),
  Stellar address detection, one-click "Pay with EPay", reusing the shared
  `useWallet` hook. Typechecks, passes 12 unit tests, builds `dist/`.

---

## 🔜 Planned

Scoped, not started. Ordered by dependency, not by desire.

### CI health — ✅ done

The three blockers listed here (ESLint 10 requiring a flat config, Prisma 7
requiring a driver adapter, and Jest not transforming `@stellar/stellar-sdk`'s
ESM-only dependencies) are **fixed**. Lint, typecheck and tests are real gates
across the workspace, and `pnpm ci:local` reproduces CI locally.

One claim in this section was also wrong and has been corrected: `pnpm typecheck`
was **not** green. `apps/api/tsconfig.json` excluded `*.spec.ts` and `test/`, so
the API's type errors were invisible. With specs in the program, `tsc` reported
182 errors — mostly one root cause (the Prisma mock did not model Prisma's
delegate getters), plus stale fixtures using a `currency` field the DTO does not
define. All are fixed.

Since then the `e2e` and `format` jobs were added to CI and
`--passWithNoTests` was removed from every package — no test script uses it
today. Remaining CI work is tracked in
[`docs/FINAL-ENGINEERING-REPORT.md`](./docs/FINAL-ENGINEERING-REPORT.md#18-remaining-risks-and-todo):
wiring `tests/k6` into CI and making `pnpm audit` blocking.

### Indexer test coverage — ✅ done in the working tree

`apps/indexer` now has **114 tests across 10 files** with enforced coverage
floors (`vitest.config.ts`: lines ≥ 90, branches ≥ 80). They cover XDR decoding
against fixtures built with the Stellar SDK, unknown and malformed events
(counted, not dropped), paging, RPC retry/backoff and rate limits, checkpoint
recovery from corrupted values, checkpoint rewind refusal, batch retry-in-place,
ledger-skip prevention, idempotent replay, `/metrics` exposition, the probes, and
reconciliation. See [`docs/INDEXER.md`](./docs/INDEXER.md#testing).

### Coverage thresholds — **partially met**

Floors are enforced in four packages — `apps/api`, `apps/indexer`,
`packages/sdk` and `packages/shared` — so coverage cannot regress. The stated
targets are still not met: `apps/api` sits at ~52% lines / ~65% branches / ~71%
functions against an 80% overall goal and 90% for payment, refund, settlement and
auth code.

### Indexer read-model projections — **blocking**

The indexer decodes and stores every event exactly once, but it does not project
them onto `payments`, `escrow`, `refunds` or `subscriptions`: no column ties an
on-chain id to an off-chain row, and nothing in the API submits a Soroban
transaction in the first place. [`docs/INDEXER.md`](./docs/INDEXER.md#not-yet-implemented-read-model-projections)
states the exact gap and what closing it requires. It is a product-integration
gap, not a data-integrity defect in what exists today.

### Contract audit

No third-party audit has been performed. The
[funds-at-risk tier](./packages/contracts/README.md#trust-tiers) is the first
scope: `EscrowManager`, `RefundManager`, `TreasuryVault`, `PaymentRouter`,
`FeeManager`. **Blocking for mainnet**; funded in the SCF Wave 8 application.

### Deeper fuzz coverage

Property/fuzz suites cover the four funds-at-risk contracts. Extending them to the
control-plane contracts (`UpgradeManager`, `RoleManager`,
`ConfigurationManager`) would close the remaining gap. Also worth adding: an
explicit state-machine model (e.g. `proptest` stateful testing) so a random
sequence of _any_ legal calls is validated against the spec.

### Wire AI summaries to the metrics

The Grafana cost dashboard and `EpayAiSpendAnomaly` alert exist and wait for the
`epay_ai_tokens_total` emitter to be called by the AI module.

### On-chain events for remaining state changes

`revoke_badge` and badge-definition updates in `ImpactNFT` do not emit events; the
indexer cannot observe them. Add events and catalogue them in
[EVENTS.md](./packages/contracts/EVENTS.md).

### Reputation and governance

- Volume-based merchant/customer tiers, extending `MerchantRegistry`.
- Wallet-bound badge NFTs so reputation travels across dApps.
- On-chain governance for merchant verification, badge-gated.
- Wire `PriceOracle` into `PaymentRouter` so merchants can accept USDC alongside
  XLM.

### Internationalisation

An i18n layer covering English, French, and Spanish for the customer web app.

### Multi-region

The API and database run single-region; latency targets assume a nearby client.
Multi-region reads would require deciding where the indexer's checkpoint lease
lives.

---

## Known issues

| Issue                                                                                   | Impact                                                                | Status                                                                                                       |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| No third-party smart-contract audit                                                     | Funds-at-risk contracts are unaudited                                 | **Open** — **blocks mainnet**                                                                                |
| Indexer does not project events onto the read model                                     | On-chain state is not mirrored into `payments` / `escrow` / `refunds` | **Open** — deliberate; see [`docs/INDEXER.md`](./docs/INDEXER.md#not-yet-implemented-read-model-projections) |
| API coverage is ~52% lines against an 80% goal                                          | Payment, refund, settlement and auth paths are thinly covered         | **Open** — floors enforced, so it cannot regress silently                                                    |
| `tests/k6` load profiles are not wired into CI                                          | Performance regressions are not gated                                 | **Open** — scripts and SLOs exist in [`docs/performance.md`](./docs/performance.md)                          |
| `pnpm audit` is advisory (`continue-on-error: true`)                                    | New high or critical advisories do not fail the build                 | **Open** — promote once the current set is triaged                                                           |
| Dockerfiles use mutable base tags (`node:26-alpine`) and `pnpm@latest`                  | Images are not reproducible                                           | **Open** — the Helm chart enforces digests at deploy time, but images are not digest-pinned at build         |
| ZAP baseline scan is informational (`fail_action: false`)                               | DAST regressions are reported, not blocked                            | **Open** — promote to blocking after the baseline is triaged                                                 |
| `pnpm lint` could not run at all (ESLint 10 needs flat config; repo had `.eslintrc.js`) | Lint was not a CI gate; style regressions went unreviewed             | **Fixed** — flat config; 22/22 tasks, 0 errors                                                               |
| API Jest suite failed to load (Prisma 7 driver adapter; stellar-sdk not transformed)    | 126 test cases could not execute                                      | **Fixed** — 18 suites, 126 tests pass                                                                        |
| Webhook delivery had no scheduler wired to `processDue()`                               | Signed deliveries accumulated and were never sent                     | **Fixed** — `WebhookDispatchScheduler`, atomic claim, metrics, alert                                         |
| `pnpm format:check` ran locally but not in CI                                           | Formatting could regress on a pull request                            | **Fixed** — `format` job added to `.github/workflows/ci.yml`                                                 |
| `scripts/ci-local.sh` built a Dockerfile path that does not exist                       | The `docker` stage could never pass                                   | **Fixed** — builds `infra/docker/Dockerfile.api`                                                             |
| `main` previously could not build at all (`@epay/hooks`, Prisma 7, `vite@5`)            | Every CI job failed                                                   | **Fixed**                                                                                                    |

---

## Funding

If awarded SCF Wave 8 funding, the grant covers the external smart-contract audit
(~40%), production infrastructure and CI/CD hardening (~25%), developer tooling
including SDK v1.0 and the payment embed widget (~20%), and community adoption
(~15%).

## Principles

- **No mainnet without an audit.** The escrow, treasury, and fee contracts handle
  value and must be verified by a third party first.
- **Non-custodial by construction.** EPay never holds user funds
  ([ADR 0002](./docs/adr/0002-custody-model.md)).
- **Honest status.** If it is not in `main` and passing CI, it is not shipped —
  and a stale claim is worse than a missing one.
