# Changelog

All notable changes to the EPay project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
