# EPay

<div align="center">

<img src="public/logo.svg" alt="EPay" width="120" height="120" />

[![CI](https://github.com/DamiDeji/EPay/actions/workflows/ci.yml/badge.svg)](https://github.com/DamiDeji/EPay/actions/workflows/ci.yml)
[![Contracts](https://github.com/DamiDeji/EPay/actions/workflows/contracts.yml/badge.svg)](https://github.com/DamiDeji/EPay/actions/workflows/contracts.yml)
[![Code Quality](https://github.com/DamiDeji/EPay/actions/workflows/codeql.yml/badge.svg)](https://github.com/DamiDeji/EPay/actions/workflows/codeql.yml)

  <h3>Enterprise-Grade Decentralized Payment Gateway on Stellar</h3>
  <p>Seamless payments, invoices, escrow, subscriptions, and settlement — powered by Soroban smart contracts on the Stellar network.</p>

  <p>
    <a href="https://epay-web-teal.vercel.app"><strong>🖥️ Live Demo</strong></a> ·
    <a href="https://epay-merchant.vercel.app">Merchant Dashboard</a> ·
    <a href="https://epay-admin-two.vercel.app">Admin Panel</a>
  </p>
</div>

---

## 📖 Overview

EPay is a decentralized Web3 payment gateway built on the [Stellar](https://stellar.org) network using [Soroban](https://soroban.stellar.org) smart contracts (Rust). It provides a complete payment infrastructure — smart contracts, REST API, SDK, blockchain indexer, and three dashboards — enabling merchants, businesses, and developers to send, receive, and manage digital payments without relying on centralized payment processors.

---

## 🌟 Why Stellar?

EPay is built specifically for the Stellar network because Stellar offers an ideal foundation for a decentralized payment gateway:

| Capability | Why It Matters for EPay |
|-----------|------------------------|
| **3–5 second settlement** | Payments confirm near-instantly — critical for merchant point-of-sale and e-commerce use cases |
| **Sub-cent transaction fees** | Stellar transactions cost fractions of a cent, making micropayments and high-volume billing economically viable |
| **Built-in DEX & orderbook** | Stellar's on-chain orderbook enables seamless asset conversion — merchants can accept any Stellar token and settle in their preferred asset |
| **Soroban smart contracts** | Rust-based WASM contracts with predictable fees, resource metering, and a growing developer ecosystem |
| **Wide wallet ecosystem** | Freighter, xBull, Albedo, Rabet, Lobstr — merchants and customers already have Stellar wallets |
| **Real-world adoption** | Stellar powers remittance corridors, aid distribution (UNHCR, Red Cross), and real-world asset tokenization |
| **Anchor network** | SEP-24 on/off-ramps enable fiat ↔ crypto conversion, bridging traditional finance with blockchain payments |
| **Regulatory clarity** | Stellar's focus on compliance and real-world use cases aligns with EPay's goal of merchant-grade reliability |

Other blockchains may offer smart contracts, but none combine Stellar's settlement speed, fee structure, built-in DEX, and real-world adoption in a way purpose-built for payment infrastructure. EPay leverages all of these to deliver a payment gateway that's fast, cheap, and ready for real businesses.

---

## 🏗 Architecture

```
epay/
├── apps/
│   ├── api/                  # NestJS REST API (15 modules)
│   ├── web/                  # Customer-facing landing page + dashboard
│   ├── merchant-dashboard/   # Merchant analytics & management
│   ├── admin-dashboard/      # Platform administration panel
│   └── indexer/              # Stellar Horizon + Soroban event indexer
├── packages/
│   ├── contracts/            # 12 Soroban (Rust) smart contracts
│   ├── sdk/                  # TypeScript SDK (Stellar SDK + Soroban SDK)
│   ├── database/             # Prisma ORM (21 models)
│   ├── types/                # Shared TypeScript type definitions
│   ├── ui/                   # Shared React UI components (shadcn/ui style)
│   ├── hooks/                # React hooks (useApi, useAuth, useWallet, etc.)
│   ├── shared/               # Shared utilities & helpers (Stellar)
│   └── config/               # Environment-based configuration
└── .github/workflows/        # CI/CD pipelines
```

---

## ✨ Features

### Smart Contracts (12 Soroban contracts)
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
- **Auth**: JWT, API key, Stellar wallet authentication with role-based guards
- **Swagger** documentation on all endpoints
- **70 source files** — zero type errors

### Blockchain Indexer
- Ledger-by-ledger Stellar Horizon scanning with configurable batch size
- Event handlers for 5 Soroban contract types (Payment, Escrow, Refund, Subscription, Treasury)
- Historical sync engine with consecutive failure abort (5 max)
- Real-time sync engine with exponential backoff
- BullMQ queue + worker with 5x concurrency and rate limiting
- Checkpoint-based crash recovery via Prisma

### Frontend Apps (3 dashboards)

| App | Pages | Key Features |
|-----|-------|-------------|
| **Web** | Landing, Login, Register, Dashboard (Overview, Payments, Invoices, Wallet, Escrow, Settings) | Hero with gradient animation, dark mode, Framer Motion, responsive |
| **Merchant** | Login, Dashboard, Payments, Invoices, Analytics, Settlements, Refunds, Subscriptions, Payment Links, Settings | Recharts (bar/line/pie), stat cards, export, QR codes |
| **Admin** | Login, Overview, Merchants, Payments, Audit Log, Analytics, Settings | Merchant approve/suspend/verify, expandable audit log, platform health, emergency pause |

**Live on Vercel:**
- 🔗 **Web:** [epay-web-teal.vercel.app](https://epay-web-teal.vercel.app)
- 🔗 **Merchant:** [epay-merchant.vercel.app](https://epay-merchant.vercel.app)
- 🔗 **Admin:** [epay-admin-two.vercel.app](https://epay-admin-two.vercel.app)

### TypeScript SDK
- **EPayClient**: JWT + API key auth, auto-retry with backoff, timeout handling, GET/POST/PATCH/PUT/DELETE
- **WalletClient**: Stellar auth message generation, public key validation, balance lookup via Horizon; supports Freighter, xBull, Albedo, Rabet, Lobstr
- **9 resource modules**: Payments, PaymentLinks, Invoices, Escrows, Refunds, Subscriptions, Merchants, Settlements, Analytics
- **Stellar utilities**: stroops/XLM conversion, address formatting, explorer URLs, fee calculation
- **Full README** with 400+ lines of code examples + 4 runnable example scripts

### Database (Prisma + PostgreSQL)
- **21 models**: User, Merchant, Wallet, Trustline, Payment, Invoice, InvoiceItem, Escrow, Milestone, Refund, Subscription, Settlement, TreasuryTransaction, Notification, WebhookDelivery, ApiKey, AuditLog, PaymentLink, SubscriptionPayment, AnalyticsSnapshot, IdempotencyKey
- Normalized schema with proper relations, enums, and indexes
- Seed script with Stellar testnet sample data

---

## 🔒 Security

- **Authorization checks** on all state-mutating contract functions
- **Role-based access control** — Admin, Merchant, Customer, Developer roles
- **API key + JWT** dual authentication with refresh tokens
- **Input validation** via Zod schemas and DTOs
- **Rate limiting** on auth and payment endpoints
- **Emergency pause** circuit breaker in smart contracts
- **Audit logging** — immutable trail of all platform actions
- **Least privilege** principle across all modules

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Rust** ≥ 1.77 (for Soroban contracts)
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
# Edit .env with your database and Stellar endpoint URLs

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

# Build contracts (requires Rust + wasm target)
cd packages/contracts && cargo build --target wasm32-unknown-unknown --release

# Run all tests
pnpm test

# Build everything
pnpm build
```

---

## 📦 Package Overview

| Package | Description | Type |
|---------|-------------|------|
| `@epay/contracts` | Soroban smart contracts (12 contracts, Rust) | Library |
| `@epay/api` | NestJS REST API server | App |
| `@epay/web` | Customer landing page + dashboard | App |
| `@epay/merchant-dashboard` | Merchant analytics & management | App |
| `@epay/admin-dashboard` | Platform administration | App |
| `@epay/indexer` | Stellar Horizon event indexer | App |
| `@epay/sdk` | TypeScript SDK for EPay API | Library |
| `@epay/database` | Prisma ORM client & schema | Library |
| `@epay/types` | Shared TypeScript type definitions | Library |
| `@epay/ui` | Shared React UI components | Library |
| `@epay/hooks` | React hooks for API & wallet | Library |
| `@epay/shared` | Shared utilities & helpers | Library |
| `@epay/config` | Environment configuration | Library |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Soroban (Rust), Stellar Network |
| **Backend** | NestJS, Fastify, TypeScript, Prisma, PostgreSQL, Redis, BullMQ |
| **Frontend** | Next.js 15, React 19, Tailwind CSS, Framer Motion, Recharts |
| **SDK** | TypeScript, Stellar SDK, isomorphic fetch |
| **Indexer** | TypeScript, BullMQ, Pino, Stellar Horizon API |
| **Wallets** | Freighter, xBull, Albedo, Rabet, Lobstr |
| **Testing** | Jest, Vitest, Cargo test |
| **DevOps** | Turborepo, pnpm workspaces, GitHub Actions, Dependabot |

---

## 🧪 Testing

| Package | Framework | Tests | Coverage |
|---------|-----------|-------|----------|
| `@epay/contracts` | Cargo test | 12 spec files | Run `cargo test` to generate |
| `@epay/api` | Jest | 16 suites, 105 tests | 50% lines (services: ~76%, controllers: 0%) |
| `@epay/sdk` | Vitest | 4 suites, 91 tests | 87% statements, 87% lines |

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run contracts tests only
cargo test --manifest-path packages/contracts/Cargo.toml
```

---

## 📄 Documentation & Links

- **[Architecture](./docs/ARCHITECTURE.md)** — System architecture and data flow
- **[Team](./TEAM.md)** — Who's building EPay
- **[Roadmap](./ROADMAP.md)** — Development milestones and grant funding plans
- **[Security](./SECURITY.md)** — Vulnerability reporting and audit status
- **[Contributing](./CONTRIBUTING.md)** — How to contribute
- **[SDK Docs](./packages/sdk/README.md)** — TypeScript SDK documentation

---

## 📄 API Documentation

The API exposes Swagger documentation at `/api/docs` when running in development mode. The full SDK documentation with code examples is available in the [SDK README](./packages/sdk/README.md).

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📜 License

MIT © EPay
