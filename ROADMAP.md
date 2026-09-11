# EPay Roadmap

**How to read this document.** `Shipped` means the code is merged to `main` and
passes CI. `In Progress` means there is an open pull request with a verified
working tree — not a promise, not a design sketch. `Planned` means scoped but not
started. Nothing is listed as `Shipped` unless it is in `main`.

Last reviewed: 2026-09-11.

---

## ✅ Shipped

Everything below is in `main` today.

### Smart contracts
- 12 Soroban contracts: `PaymentRouter`, `InvoiceManager`, `EscrowManager`,
  `RefundManager`, `SubscriptionManager`, `SettlementManager`, `MerchantRegistry`,
  `TreasuryVault`, `FeeManager`, `ConfigurationManager`, `EmergencyPause`,
  `RoleManager`.
- Deployed to Stellar testnet with addresses recorded in `DEPLOYMENTS.md`.
- Test coverage in 4 of 12 contract suites (PaymentRouter, EscrowManager,
  TreasuryVault, RefundManager). **The other 8 still have empty test stubs** — see
  *Planned*.

### Backend
- NestJS + Fastify API with 15 modules (Database, Health, Auth, Merchant,
  Payment, Invoice, Escrow, Refund, Subscription, Settlement, Treasury,
  Notification, Webhook, Analytics, Audit).
- JWT + API key + wallet-signature authentication; global throttling; Swagger
  docs at `/api/docs`.
- Blockchain indexer: Horizon scanning, 5 Soroban event handlers, historical and
  real-time sync, BullMQ queue, checkpoint-based recovery.

### Frontends
- Customer web app, merchant dashboard, and admin dashboard (Next.js 15 /
  React 19), all deployed to Vercel.

### SDK & data
- TypeScript SDK: `EPayClient`, `WalletClient`, 9 resource modules, Stellar
  helpers, 91 passing tests.
- Prisma schema with 21 models and a seed script.

### DevOps
- Turborepo + pnpm workspace; GitHub Actions CI (lint, typecheck, test, build);
  CodeQL; Dependabot; Gitleaks secret scanning.

---

## 🚧 In Progress

Open work with a verified local build. These are **not** in `main` yet.

### Client surfaces
- **Mobile app (`apps/mobile`)** — Expo SDK 57 / React Native 0.86, `expo-router`
  navigation, QR payment scanning, biometric payment authorization, secure token
  storage, push receipts, offline-tolerant caching. Typechecks, passes 11 unit
  tests, and exports iOS + Android bundles.
- **Browser extension (`apps/extension`)** — Manifest V3 with Chrome and Firefox
  manifests, Stellar address detection on visited pages, one-click "Pay with
  EPay" from the popup, reusing the shared `useWallet` hook. Typechecks, passes
  12 unit tests, and builds `dist/`.

### Production operations
- **Observability** — `monitoring/` Prometheus + Grafana + Alertmanager stack,
  four provisioned dashboards, nine alert rules, PagerDuty/Slack routing.
- **Kubernetes** — `helm/epay/` chart (lint- and template-verified, 30 rendered
  resources) and generated `k8s/manifests.yaml`; HPA (2–10), PDB, default-deny
  NetworkPolicy.
- **GitOps** — `gitops/argocd-application.yaml` with an Argo Rollouts canary
  gated on a Prometheus payment-success-rate analysis.
- **Disaster recovery** — nightly `pg_dump` backup and a scheduled monthly
  restore drill that restores into ephemeral Postgres and asserts referential
  integrity.
- **Supply chain** — SBOM generation, Trivy image scans, cosign keyless signing
  on tags, blocking Gitleaks.

### Toolchain repair
- Fixed three pre-existing `main` breakages: `@epay/hooks` could not build
  (missing `types`), Prisma 7 required `prisma.config.ts` instead of
  `datasource.url`, and the locked `vite@5` broke every vitest suite.

---

## 🔜 Planned

Scoped, not started. Ordered by dependency, not by desire.

### Contract test depth
Eight contract suites have no real tests. Before any external audit this needs
property-based/fuzz testing (target: 10,000+ iterations) plus a fuzz harness.
**Blocking for mainnet.**

### Contract trust hardening
Two-step `transfer_admin` → `accept_admin`, `pause_contract`/`unpause_contract`
extending `EmergencyPause`, and timelocked `propose_upgrade` → `execute_upgrade`.
Design recorded in [ADR 0004](./docs/adr/0004-upgrade-pattern.md); not yet
implemented in Rust.

### Reputation and governance
- Volume-based merchant/customer tiers, extending `MerchantRegistry`.
- Wallet-bound badge NFTs so reputation travels across dApps.
- On-chain governance for merchant verification, badge-gated.
- A price oracle so `PaymentRouter` can accept USDC alongside XLM.

### AI-assisted summaries
A NestJS module that generates plain-language explainers for merchants,
invoices, and settlements via the Anthropic API, cached server-side, surfaced in
the merchant dashboard and customer web app. The Grafana cost dashboard and
`EpayAiSpendAnomaly` alert already exist and are waiting for the emitter.

### Testing breadth
Playwright end-to-end coverage per dashboard with `@axe-core/playwright`
accessibility checks, an OWASP ZAP baseline DAST scan, and k6 load tests with
documented SLOs in `docs/performance.md`.

### Internationalisation
An i18n layer covering English, French, and Spanish for the customer-facing web
app.

### API security consistency
Helmet and a global `ThrottlerGuard` are in place, but CSRF, CSP, and
per-endpoint rate limits have not been audited across all 15 modules. Wallet
address validation also needs a shared validator.

---

## Known issues

| Issue | Impact | Status |
| --- | --- | --- |
| `apps/api` does not typecheck (162 errors) and the three Next.js dashboards do not build | `pnpm build` and `pnpm test` cannot go green in CI | **Open** — predates the current work; blocks the "full test suite passes" criterion |
| 8 of 12 contract suites have empty test stubs | Contract regressions are undetectable | **Open** — see *Planned* |
| `main` previously could not build at all (`@epay/hooks`, Prisma 7, `vite@5`) | Every CI job failed | **Fixed** in this work |
| Dockerfiles use mutable base tags (`node:26-alpine`) and unpinned pnpm | Builds are not reproducible | **Open** — the Helm chart enforces digests at deploy time, but the images themselves are not digest-pinned |

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
- **Honest status.** If it is not in `main` and passing CI, it is not shipped.
