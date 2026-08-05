# EPay SDK Examples

Practical, copy-paste-ready examples demonstrating the EPay TypeScript SDK.

## Prerequisites

```bash
# Install dependencies from the monorepo root
cd /path/to/EPay
pnpm install

# Build the SDK (if not already built)
pnpm --filter @epay/sdk build
```

## Running Examples

Each example is a self-contained TypeScript file. Run with `tsx`:

```bash
# Basic payment & invoice operations
npx tsx examples/basic-usage.ts

# Escrow milestones & subscription management
npx tsx examples/escrow-workflow.ts

# Wallet integration & TON utilities
npx tsx examples/wallet-integration.ts

# Refunds, settlements, analytics & merchants
npx tsx examples/advanced-flows.ts
```

### Setting the API URL

Set environment variables to point to your EPay API instance:

```bash
EPAY_API_URL=https://api.epay.dev EPAY_API_KEY=ep_live_xxx npx tsx examples/basic-usage.ts
```

Without them, examples default to `http://localhost:4000` with a test key.

## Example Index

| File | Topics |
|------|--------|
| [`basic-usage.ts`](./basic-usage.ts) | Client setup, payments, invoices, pagination, error handling |
| [`escrow-workflow.ts`](./escrow-workflow.ts) | Multi-milestone escrow lifecycle, subscription plans |
| [`wallet-integration.ts`](./wallet-integration.ts) | TON wallet auth, balance, nanoTON conversion, fees |
| [`advanced-flows.ts`](./advanced-flows.ts) | Refunds, settlements, analytics, merchant management, payment links |
