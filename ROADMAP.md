# EPay Roadmap

**How to read this document.** `Shipped` means the code is merged to `main` and
passes CI. `In Progress` means there is an open pull request with a verified
working tree — not a promise, not a design sketch. `Planned` means scoped but not
started. Nothing is listed as `Shipped` unless it is in `main`.

Last reviewed: 2026-09-14.

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
- **Test coverage.** 267 Rust `#[test]` functions across all 16 suites, including
  **10,000-iteration property/fuzz suites** for the four funds-at-risk contracts
  (`TreasuryVault`, `EscrowManager`, `RefundManager`, `SettlementManager`),
  asserting conservation-of-funds and state-machine invariants.
- **Documentation.** Per-contract entry points, access control, and invariants
  ([`packages/contracts/README.md`](./packages/contracts/README.md)); ownership,
  upgrade, and pause model ([`packages/contracts/SECURITY.md`](./packages/contracts/SECURITY.md));
  and every emitted event ([`packages/contracts/EVENTS.md`](./packages/contracts/EVENTS.md)).
- Deployed to Stellar testnet with addresses in [DEPLOYMENTS.md](./DEPLOYMENTS.md).

### Backend

- NestJS + Fastify API with 15 domain modules plus an observability module; JWT,
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
- Indexer: Horizon scanning, event handlers, historical + real-time sync with
  checkpoint recovery, BullMQ queue, Pino structured logging.

### Frontends & SDK

- Customer web app, merchant dashboard, and admin dashboard (Next.js 15 /
  React 19), deployed to Vercel. See
  [ADR 0006](./docs/adr/0006-dashboard-decomposition.md) for why three apps.
- TypeScript SDK: `EPayClient`, `WalletClient`, 9 resource modules, Stellar
  helpers, 91 tests.
- Prisma schema with 21 models and a seed script. See
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
  assertions, k6 load tests with SLOs in
  [`docs/performance.md`](./docs/performance.md), and an OWASP ZAP baseline DAST
  workflow.

### Documentation

- [`docs/`](./docs/README.md) index with getting started, architecture and
  rationale, integration guide, webhook receiver contract, performance SLOs,
  disaster recovery, external secrets, and six ADRs.

---

## 🚧 In Progress

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

### CI health

Three pre-existing issues keep a fully green CI out of reach. None is a runtime
bug, and all three are configuration:

1. **ESLint cannot run.** The repo has a legacy `.eslintrc.js`, but the installed
   ESLint 10 requires a flat `eslint.config.js`. Every `pnpm lint` invocation
   aborts before evaluating a single rule, so lint is not currently a gate.
2. **The API Jest suite does not load.** Prisma 7 requires a driver adapter
   (`@prisma/adapter-pg`) that `packages/database` does not pass to
   `PrismaClient`, and Jest is not configured to transform
   `@stellar/stellar-sdk`'s CommonJS output. The 116 test cases exist; they cannot
   execute.
3. **No `apps/*` build in CI for the API image.** The Nest CLI tolerates the
   type surface that `tsc --noEmit` accepts, but the build is only proven locally
   and in the image jobs.

`pnpm typecheck` (22/22 tasks) and `pnpm build` (15/15 tasks) are green. Restoring
lint and the API test suite is a prerequisite for trusting the suite as a
regression net during the audit. **Blocking for audit.**

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
sequence of *any* legal calls is validated against the spec.

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

| Issue | Impact | Status |
| --- | --- | --- |
| `pnpm lint` cannot run at all (ESLint 10 needs flat config; repo has `.eslintrc.js`) | Lint is not a CI gate; code-style regressions are unreviewed | **Open** — migration scoped in *Planned* |
| API Jest suite fails to load (Prisma 7 driver adapter; stellar-sdk not transformed) | 116 test cases cannot execute; no API regression net | **Open** — scoped in *Planned* |
| No third-party smart-contract audit | Funds-at-risk contracts are unaudited | **Open** — **blocks mainnet** |
| Dockerfiles use mutable base tags (`node:26-alpine`) and unpinned pnpm | Images are not reproducible | **Open** — the Helm chart enforces digests at deploy time, but the images are not digest-pinned at build |
| Webhook delivery has no scheduler wired to `processDue()` | Deliveries are signed and stored; a periodic tick still needs to call the dispatcher | **Open** — the code and schema exist; the cron/worker entry point is the missing piece |
| ZAP baseline scan is informational (`fail_action: false`) | DAST regressions are reported, not blocked | **Open** — promote to blocking after the baseline is triaged |
| `main` previously could not build at all (`@epay/hooks`, Prisma 7, `vite@5`) | Every CI job failed | **Fixed** |

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
