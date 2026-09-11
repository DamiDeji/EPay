# Changelog

All notable changes to the EPay project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

#### Client surfaces
- `apps/mobile` — Expo SDK 57 / React Native 0.86 mobile app using `expo-router`,
  reusing `@epay/sdk` and `@epay/types`. QR payment scanning (`expo-camera`),
  biometric payment authorization with device-passcode fallback disabled
  (`expo-local-authentication`), secure token storage (`expo-secure-store`),
  push receipts (`expo-notifications`), and offline-tolerant caching over
  AsyncStorage. Exports iOS + Android bundles from one codebase.
- `apps/extension` — Manifest V3 browser extension for Chrome and Firefox
  (`manifest.json` + `manifest.firefox.json`). Detects Stellar public keys in page
  text and offers a one-click "Pay with EPay" action, reusing the shared
  `useWallet` hook from `@epay/hooks`.

#### Observability
- `monitoring/` — Prometheus, Grafana, and Alertmanager stack with a
  bearer-token-gated `/metrics` scrape path.
- Four provisioned Grafana dashboards: platform health, payment-flow success
  rate, queue lag, and AI cost.
- Nine alert rules covering 5xx rate, p99 latency, readiness-probe failures, DB
  pool wait, slow-query p99, queue lag, backup-missed, restore-drill-failed, and
  AI spend anomalies; PagerDuty + Slack routing with business-hours inhibition.
- API `GET /health/live` (dependency-free liveness) and `GET /health/ready`
  (database-checked readiness) alongside the existing `GET /health`.

#### Deployment & GitOps
- `helm/epay/` chart: API, indexer, three dashboards, PostgreSQL StatefulSet,
  Ingress, ConfigMap, pre-upgrade Prisma migration Job, HPA (2–10),
  PodDisruptionBudget (`minAvailable: 1`), default-deny NetworkPolicy with
  explicit allows, and optional Prometheus Operator ServiceMonitors. Refuses to
  render in production unless every image is pinned to a digest.
- `k8s/manifests.yaml` — raw manifests generated from the chart via
  `scripts/render-k8s-manifests.sh`; CI fails if they drift.
- `gitops/argocd-application.yaml` — Argo CD Application plus an Argo Rollouts
  canary gated on a Prometheus payment-success-rate `AnalysisTemplate`.

#### Security & supply chain
- `.github/workflows/supply-chain.yml` — CycloneDX SBOM per push, Trivy
  filesystem and image scans (informational on branches, blocking on tags),
  cosign keyless signing of release images, and blocking Gitleaks.
- Curated `.gitleaks.toml` with rules for Stellar secret keys, EPay API keys,
  webhook secrets, Anthropic keys, and credentialed Postgres URIs.
- `SECURITY.md` — GitHub Security Advisories as the private disclosure channel
  and a concrete response SLA (48h acknowledgement, 30/60/90-day patch targets).

#### Disaster recovery
- `.github/workflows/backup.yml` — nightly encrypted-aware `pg_dump` with
  archive verification and a 30-day retention window.
- `.github/workflows/restore-drill.yml` — monthly scheduled restore into an
  ephemeral Postgres with integrity assertions; also runnable on demand.
- `scripts/backup-postgres.sh`, `scripts/restore-drill.sh`,
  `scripts/verify-restore.sql`.
- `docs/disaster-recovery.md` (RTO/RPO, failure modes, secret-compromise
  runbook) and `docs/restore-runbook.md` (step-by-step restore with rollback).

#### Documentation
- ADRs `docs/adr/0001-chain-choice.md`, `0002-custody-model.md`,
  `0003-auth-model.md`, `0004-upgrade-pattern.md`.

### Changed

- `ROADMAP.md` rewritten with an honest Shipped / In Progress / Planned split and
  a Known Issues section; nothing is marked Shipped unless it is in `main`.
- `CONTRIBUTING.md` now has a concrete PR checklist covering tests, lint,
  typecheck, OpenAPI accuracy for API changes, Helm lint/template, a
  `[Unreleased]` changelog entry, and a Gitleaks-clean diff.
- Helm chart is lint-tested and template-tested in CI, plus a digest-pinning
  assertion and a raw-manifest drift check.

### Fixed

- `@epay/hooks` could not build: `packages/hooks/tsconfig.json` was missing the
  `types` array used by every other package, so `process` was undefined.
- Prisma 7 removed `datasource.url` from `schema.prisma` and the `metrics` /
  `tracing` / `fullTextSearch` preview flags, which broke `prisma generate` and
  therefore every dependent build. Added `packages/database/prisma.config.ts`.
- `pnpm-lock.yaml` had resolved `vite@5.4.21`, which fails against `vitest@4`
  with `ERR_PACKAGE_PATH_NOT_EXPORTED` and broke **every** test suite in the
  monorepo. `vite` is now pinned to `^7.0.0`, restoring the SDK's 91 tests.
- Stale `*.tsbuildinfo` files could make `tsc --noEmit` report resolved errors;
  they are no longer committed.
- pnpm settings moved from the ignored root `package.json` `pnpm` field to
  `pnpm-workspace.yaml`, so `onlyBuiltDependencies` is honoured again.
- `apps/api` builds with `nest build` again by pinning the package to TypeScript
  6, which still exposes the compiler API the Nest CLI requires (TypeScript 7
  ships the `tsc` binary only). This revealed 162 pre-existing type errors in the
  API that are still open.

## [0.1.0] — 2026-08-05

### Added

#### Smart Contracts
- `PaymentRouter` — route and process payments with status lifecycle
- `EscrowManager` — multi-milestone escrow with dispute resolution
- `RefundManager` — full and partial refund engine
- `SubscriptionManager` — recurring billing with pause/resume/cancel
- `InvoiceManager` — invoice lifecycle (draft → issued → paid → cancelled)
- `SettlementManager` — periodic settlement processing with fee calculation
- `MerchantRegistry` — merchant onboarding and verification
- `TreasuryVault` — treasury accounting and fee collection
- `FeeManager` — configurable fee structure
- `ConfigurationManager` — platform-wide configuration
- `EmergencyPause` — circuit breaker for emergency halts
- `RoleManager` — role-based access control

#### Backend (NestJS API)
- 15 modules: Database, Health, Auth, Merchant, Payment, Invoice, Escrow, Refund, Subscription, Settlement, Treasury, Notification, Webhook, Analytics, Audit
- JWT + API key + wallet authentication with 6 guards and 3 strategies
- Swagger documentation on all endpoints
- **101 unit tests** across 16 test suites

#### Frontend (Next.js)
- **Customer Web App** — landing page, auth, dashboard (overview, payments, invoices, wallet, escrow, settings)
- **Merchant Dashboard** — analytics (Recharts), payments, invoices, settlements, refunds, subscriptions, payment links
- **Admin Dashboard** — platform overview, merchant management, payments monitoring, audit log, analytics, system health

#### SDK
- `EPayClient` — JWT/API key auth, retry, timeout, 5 HTTP methods
- `WalletClient` — Stellar auth messages, address validation, balance lookup
- 9 resource modules: Payments, PaymentLinks, Invoices, Escrows, Refunds, Subscriptions, Merchants, Settlements, Analytics
- Stellar utilities: stroops/XLM conversion, address formatting, fee calculation
- **91 tests** across 4 test suites
- README with 400+ lines of code examples + 4 runnable example scripts

#### Blockchain Indexer
- Ledger-by-ledger Stellar scanning with configurable batch size
- 5 event handler types (Payment, Escrow, Refund, Subscription, Treasury)
- Historical + real-time sync engines with checkpoint recovery
- BullMQ queue with worker and Redis error handling

#### Database
- 21 Prisma models with normalized schema
- Seed script with sample data

#### DevOps
- Turborepo with pnpm workspaces (15 packages/apps)
- GitHub Actions CI (lint, typecheck, test, build)
- CodeQL security analysis
- Dependabot with auto-merge
- Conventional commit history (17 commits)
