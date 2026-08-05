# EPay

<div align="center">
  <h3>Enterprise-Grade Decentralized Payment Gateway on TON</h3>
  <p>Seamless payments, invoices, escrow, subscriptions, and settlement — powered by smart contracts on The Open Network.</p>
</div>

---

## 📖 Overview

EPay is a decentralized Web3 payment gateway built on [The Open Network (TON)](https://ton.org) using the [Tact](https://tact-lang.org) smart contract language. It provides a complete payment infrastructure — smart contracts, REST API, SDK, blockchain indexer, and three dashboards — enabling merchants, businesses, and developers to send, receive, and manage digital payments without relying on centralized payment processors.

---

## 🏗 Architecture

```
epay/
├── apps/
│   ├── api/                  # NestJS REST API (15 modules)
│   ├── web/                  # Customer-facing landing page + dashboard
│   ├── merchant-dashboard/   # Merchant analytics & management
│   ├── admin-dashboard/      # Platform administration panel
│   ├── indexer/              # TON blockchain event indexer
│   └── explorer/             # Blockchain explorer (coming soon)
├── packages/
│   ├── contracts/            # 12 Tact smart contracts
│   ├── sdk/                  # TypeScript SDK (50+ API methods)
│   ├── database/             # Prisma ORM (21 models)
│   ├── types/                # Shared TypeScript type definitions
│   ├── ui/                   # Shared React UI components (shadcn/ui style)
│   ├── hooks/                # React hooks (useApi, useAuth, useWallet, etc.)
│   ├── shared/               # Shared utilities & helpers
│   └── config/               # Environment-based configuration
└── .github/workflows/        # CI/CD pipelines
```

---

## ✨ Features

### Smart Contracts (12 contracts)
| Contract | Purpose |
|----------|---------|
| `PaymentRouter` | Route and process payments |
| `InvoiceManager` | Invoice lifecycle management |
| `EscrowManager` | Multi-milestone escrow with dispute resolution |
| `RefundManager` | Full and partial refund engine |
| `SubscriptionManager` | Recurring billing engine |
| `SettlementManager` | Periodic settlement processing |
| `MerchantRegistry` | Merchant onboarding and verification |
| `TreasuryVault` | Treasury accounting and fee collection |
| `FeeManager` | Configurable fee structure |
| `ConfigurationManager` | Platform-wide configuration |
| `EmergencyPause` | Circuit breaker for emergency halts |
| `RoleManager` | Role-based access control |

### Backend API (NestJS)
- **15 modules**: Database, Health, Auth, Merchant, Payment, Invoice, Escrow, Refund, Subscription, Settlement, Treasury, Notification, Webhook, Analytics, Audit
- **Auth**: JWT, API key, wallet authentication with role-based guards (6 guards, 3 strategies, 2 decorators)
- **Swagger** documentation on all endpoints
- **93 source files** — zero type errors

### Blockchain Indexer
- Block-by-block TON scanning with configurable batch size
- Event handlers for 5 contract types (Payment, Escrow, Refund, Subscription, Treasury)
- Historical sync engine with consecutive failure abort (5 max)
- Real-time sync engine with exponential backoff
- BullMQ queue + worker with 5x concurrency and rate limiting
- Checkpoint-based crash recovery via Prisma

### Frontend Apps (3 dashboards)

| App | Pages | Key Features |
|-----|-------|-------------|
| **Web** (`:3000`) | Landing, Login, Register, Dashboard (Overview, Payments, Invoices, Wallet, Escrow, Settings) | Hero with gradient animation, dark mode, Framer Motion, responsive |
| **Merchant** (`:3001`) | Login, Dashboard, Payments, Invoices, Analytics, Settlements, Refunds, Subscriptions, Payment Links, Settings | Recharts (bar/line/pie), stat cards, export, QR codes |
| **Admin** (`:3002`) | Login, Overview, Merchants, Payments, Audit Log, Analytics, Settings | Merchant approve/suspend/verify, expandable audit log, platform health, emergency pause |

### TypeScript SDK
- **EPayClient**: JWT + API key auth, auto-retry with backoff, timeout handling, GET/POST/PATCH/PUT/DELETE
- **WalletClient**: TON auth message generation, address validation, balance lookup
- **9 resource modules**: Payments, PaymentLinks, Invoices, Escrows, Refunds, Subscriptions, Merchants, Settlements, Analytics
- **TON utilities**: nanoTon/TON conversion, address formatting, explorer URLs, fee calculation
- **Full README** with 400+ lines of code examples + 4 runnable example scripts

### Database (Prisma + PostgreSQL)
- **21 models**: User, Merchant, Wallet, Payment, Invoice, InvoiceItem, Escrow, Milestone, Refund, Subscription, Settlement, TreasuryTransaction, Notification, WebhookDelivery, ApiKey, AuditLog, IndexerState, FeeConfiguration, PaymentLink, WebhookConfig, PlatformConfig
- Normalized schema with proper relations, enums, and indexes
- Seed script with sample data

---

## 🔒 Security

- **Reentrancy protection** on all state-mutating contract functions
- **Role-based access control** — Admin, Merchant, Customer, Developer roles
- **API key + JWT** dual authentication with refresh tokens
- **Input validation** via Zod schemas and DTOs
- **Rate limiting** on auth and payment endpoints
- **Emergency pause** circuit breaker in smart contracts
- **Audit logging** — immutable trail of all platform actions
- **Least privilege** principle across all modules

---

## 🧪 Testing

| Suite | Framework | Tests | Status |
|-------|-----------|-------|--------|
| API (16 suites) | Jest + ts-jest | 101 | ✅ All passing |
| SDK (4 suites) | Vitest | 91 | ✅ All passing |
| **Total** | | **192** | ✅ |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **PostgreSQL** ≥ 15
- **Redis** ≥ 7

### Setup

```bash
# Clone
git clone https://github.com/DamiDeji/EPay.git
cd EPay

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database and TON endpoint URLs

# Generate Prisma client
pnpm --filter @epay/database prisma:generate

# Run database migrations
pnpm --filter @epay/database prisma:migrate

# Seed the database
pnpm --filter @epay/database prisma:seed
```

### Development

```bash
# Start the API server
pnpm --filter @epay/api dev          # → http://localhost:4000

# Start the customer web app
pnpm --filter @epay/web dev          # → http://localhost:3000

# Start the merchant dashboard
pnpm --filter @epay/merchant-dashboard dev  # → http://localhost:3001

# Start the admin dashboard
pnpm --filter @epay/admin-dashboard dev     # → http://localhost:3002

# Start the blockchain indexer
pnpm --filter @epay/indexer dev
```

### Build & Test

```bash
# Typecheck all packages
pnpm typecheck

# Run all tests
pnpm test

# Build everything
pnpm build
```

---

## 📦 Package Overview

| Package | Description | Type |
|---------|-------------|------|
| `@epay/contracts` | Tact smart contracts (12 contracts) | Library |
| `@epay/api` | NestJS REST API server | App |
| `@epay/web` | Customer landing page + dashboard | App |
| `@epay/merchant-dashboard` | Merchant analytics & management | App |
| `@epay/admin-dashboard` | Platform administration | App |
| `@epay/indexer` | TON blockchain event indexer | App |
| `@epay/sdk` | TypeScript SDK for EPay API | Library |
| `@epay/database` | Prisma ORM client & schema | Library |
| `@epay/types` | Shared TypeScript type definitions | Library |
| `@epay/ui` | Shared React UI components | Library |
| `@epay/hooks` | React hooks for API & wallet | Library |
| `@epay/shared` | Shared utilities & helpers | Library |
| `@epay/config` | Environment configuration | Library |

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| Source files | **207** |
| Git commits | **17** (conventional commits) |
| Smart contracts | **12** Tact contracts |
| API modules | **15** NestJS modules |
| Frontend pages | **25** across 3 dashboards |
| Database models | **21** Prisma models |
| SDK methods | **50+** typed API methods |
| Tests | **192** (101 API + 91 SDK) |
| Type errors | **0** across all packages |

---

## 📋 Project Structure Review

### Outstanding Structure (Recommended)

```
EPay/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              ✅ Lint, typecheck, test, build
│   │   ├── contracts.yml       ✅ Smart contract testing
│   │   ├── codeql.yml          ✅ Security analysis
│   │   └── dependabot-auto-merge.yml ✅ Auto-merge patch updates
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md       ✅
│   │   └── feature_request.md  ✅
│   ├── pull_request_template.md ✅
│   └── CODEOWNERS              ✅ Automated review assignment
├── apps/
│   ├── api/                    ✅ NestJS — 15 modules, 101 tests
│   ├── web/                    ✅ Next.js — landing + customer dashboard
│   ├── merchant-dashboard/     ✅ Next.js — 10-page merchant dashboard
│   ├── admin-dashboard/        ✅ Next.js — 6-page admin panel
│   ├── indexer/                ✅ TON indexer with BullMQ
│   ├── explorer/               🚧 Scaffolded (coming soon)
│   └── docs/                   🚧 Scaffolded (coming soon)
├── packages/
│   ├── contracts/              ✅ 12 Tact contracts
│   │   └── tests/              🚧 Contract tests pending
│   ├── sdk/                    ✅ 50+ methods, 91 tests, examples
│   ├── database/               ✅ Prisma — 21 models + seed
│   ├── types/                  ✅ Comprehensive type definitions
│   ├── ui/                     ✅ 6 shared components
│   ├── hooks/                  ✅ 5 React hooks
│   ├── shared/                 ✅ Utilities
│   └── config/                 ✅ Environment loader
├── infra/
│   ├── docker/                 🚧 Dockerfiles pending
│   └── terraform/              🚧 IaC pending
├── docker-compose.yml          🚧 Pending
├── .env.example                ✅
├── LICENSE                     ✅ MIT
├── SECURITY.md                 ✅
├── CONTRIBUTING.md             ✅
├── CHANGELOG.md                ✅
├── README.md                   ✅
├── turbo.json                  ✅
└── pnpm-workspace.yaml         ✅
```

### Compliance Scorecard

| Standard | Status | Score |
|----------|--------|-------|
| Monorepo structure | ✅ Turborepo + pnpm workspaces | 10/10 |
| Type safety | ✅ 0 type errors, strict mode | 10/10 |
| CI/CD | ✅ Lint, typecheck, test, build + CodeQL | 8/10 |
| Smart contract tests | 🚧 0 tests (12 contracts) | 2/10 |
| Frontend tests | 🚧 0 tests (3 dashboards) | 2/10 |
| Backend tests | ✅ 101 tests (16 suites) | 8/10 |
| SDK tests | ✅ 91 tests (4 suites) | 9/10 |
| Indexer tests | 🚧 0 tests | 2/10 |
| Documentation | ✅ README + SDK docs + examples | 8/10 |
| Open-source hygiene | ✅ LICENSE, SECURITY, CONTRIBUTING, CHANGELOG, CODEOWNERS, templates | 10/10 |
| Docker / Infrastructure | 🚧 Empty scaffold | 2/10 |
| Code quality enforcement | ✅ ESLint strict + Prettier | 7/10 |
| **OVERALL** | | **6.5/10** |

### Priority Roadmap

| Priority | Task | Impact |
|----------|------|--------|
| 🔴 P0 | Write smart contract tests (Tact test framework) | Critical for audit readiness |
| 🔴 P0 | Add Docker Compose + Dockerfiles | Required for local development & CI |
| 🟡 P1 | Add frontend component tests (3 dashboards) | Coverage & reliability |
| 🟡 P1 | Add indexer unit tests | Critical for data integrity |
| 🟢 P2 | Build Explorer app | Complete the product suite |
| 🟢 P2 | Add test coverage thresholds in CI | Enforce quality gates |
| 🟢 P3 | Add pre-commit hooks (husky + lint-staged) | Developer experience |
| 🟢 P3 | Infrastructure as Code (Terraform/K8s) | Production deployment |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Tact, TON Blockchain |
| **Backend** | NestJS, Fastify, TypeScript, Prisma, PostgreSQL, Redis, BullMQ |
| **Frontend** | Next.js 15, React 19, Tailwind CSS, Framer Motion, Recharts |
| **SDK** | TypeScript, isomorphic fetch |
| **Indexer** | TypeScript, BullMQ, Pino |
| **Testing** | Jest, Vitest, ts-jest |
| **DevOps** | Turborepo, pnpm workspaces, GitHub Actions, Dependabot |

---

## 📄 API Documentation

The API exposes Swagger documentation at `/api/docs` when running in development mode. The full SDK documentation with code examples is available in the [SDK README](./packages/sdk/README.md).

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📜 License

MIT © EPay
