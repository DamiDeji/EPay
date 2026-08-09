# EPay TypeScript SDK

Enterprise-grade TypeScript SDK for the EPay decentralized payment gateway on the Stellar network.

[![npm version](https://img.shields.io/npm/v/@epay/sdk.svg)](https://www.npmjs.com/package/@epay/sdk)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- 💳 **Payments** — Create, confirm, complete, and manage payments
- 🧾 **Invoices** — Full invoice lifecycle (draft → issued → paid → cancelled)
- 🔐 **Escrow** — Multi-milestone escrow with dispute resolution
- ↩️ **Refunds** — Full and partial refunds with approval flow
- 🔁 **Subscriptions** — Recurring billing with pause/resume/cancel
- 🏪 **Merchants** — Onboarding, verification, profile management
- 🔗 **Payment Links** — Shareable payment links with QR support
- 💰 **Settlements** — Periodic settlement processing
- 📊 **Analytics** — Revenue, volume, and success rate insights
- 👛 **Wallet** — Stellar wallet integration, auth, and balance lookups
- 🔧 **Utilities** — stroops/XLM conversion, address validation, fee calculation

---

## Installation

```bash
npm install @epay/sdk
# or
pnpm add @epay/sdk
# or
yarn add @epay/sdk
```

## Quick Start

```ts
import { EPayClient } from '@epay/sdk';

const client = new EPayClient({
  apiUrl: 'https://api.epay.dev',
  apiKey: 'ep_live_xxxxxxxxxxxxxxxx',
});

// Create a payment
const payment = await client.payments.create({
  merchantId: 'merch_abc123',
  amount: '1000000000', // 1 XLM in stroops
  currency: 'XLM',
  recipientAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU',
  description: 'Premium plan upgrade',
});

console.log(`Payment created: ${payment.paymentId}`);
```

---

## Authentication

The SDK supports two authentication methods:

### API Key (Server-side)

```ts
const client = new EPayClient({
  apiKey: 'ep_live_xxxxxxxxxxxxxxxx',
});

// Or set after initialization
client.setApiKey('ep_live_xxxxxxxxxxxxxxxx');
```

### JWT Access Token (Client-side)

```ts
const client = new EPayClient({
  accessToken: 'eyJhbGciOiJIUzI1NiIs...',
});

// Or set after login
client.setAccessToken('eyJhbGciOiJIUzI1NiIs...');
```

### Clear Authentication

```ts
client.clearAuth();
```

---

## Configuration

```ts
interface EPayClientConfig {
  /** API base URL. Default: 'http://localhost:4000' */
  apiUrl?: string;

  /** API key for server-side authentication */
  apiKey?: string;

  /** JWT access token for client-side authentication */
  accessToken?: string;

  /** Maximum retry attempts on network errors. Default: 3 */
  maxRetries?: number;

  /** Delay between retries in ms. Default: 1000 */
  retryDelayMs?: number;

  /** Request timeout in ms. Default: 30000 */
  timeoutMs?: number;
}
```

---

## API Reference

### Payments

```ts
import { EPayClient, PaymentStatus } from '@epay/sdk';

const client = new EPayClient({ apiKey: 'ep_live_...' });

// ── Create a payment ────────────────────────────────────────────
const payment = await client.payments.create({
  merchantId: 'merch_abc123',
  amount: '5000000000',     // 5 XLM in stroops
  currency: 'XLM',
  recipientAddress: 'GAD...',
  description: 'Order #1234',
  memo: 'Thank you for your purchase',
  expiresIn: 3600,          // expires in 1 hour (seconds)
  metadata: { orderId: 'ord_1234' },
});

// ── Get a payment by ID ─────────────────────────────────────────
const existing = await client.payments.getById('pay_abc123');

// ── List payments (paginated + filtered) ────────────────────────
const { data, total, page, totalPages } = await client.payments.list({
  merchantId: 'merch_abc123',
  status: PaymentStatus.COMPLETED,
  page: 1,
  pageSize: 20,
});

// ── Confirm a payment with blockchain tx ────────────────────────
const confirmed = await client.payments.confirm('pay_abc123',
  '0x1234567890abcdef...',
);

// ── Complete / Fail / Cancel ────────────────────────────────────
await client.payments.complete('pay_abc123');
await client.payments.fail('pay_abc123');
await client.payments.cancel('pay_abc123');
```

### Payment Links

Create shareable payment links that customers can open and pay:

```ts
// ── Create a payment link ───────────────────────────────────────
const link = await client.paymentLinks.create({
  merchantId: 'merch_abc123',
  amount: '1000000000',
  currency: 'XLM',
  description: 'Community donation',
  maxPayments: 100,
  expiresIn: 86400 * 7,   // 7 days
});

console.log(`Pay here: https://epay.dev/pay/${link.code}`);

// ── Look up a link by code ──────────────────────────────────────
const found = await client.paymentLinks.getByCode('abc123');

// ── List all links for a merchant ───────────────────────────────
const links = await client.paymentLinks.listByMerchant('merch_abc123');
```

### Invoices

```ts
import { EPayClient, InvoiceStatus } from '@epay/sdk';

const client = new EPayClient({ apiKey: 'ep_live_...' });

// ── Create an invoice ───────────────────────────────────────────
const invoice = await client.invoices.create({
  merchantId: 'merch_abc123',
  amount: '7500000000',
  currency: 'XLM',
  items: [
    { description: 'Web Design', quantity: 1, unitPrice: '5000000000', total: '5000000000' },
    { description: 'Hosting (1 year)', quantity: 1, unitPrice: '2500000000', total: '2500000000' },
  ],
  dueDate: new Date(Date.now() + 30 * 86400_000),
  customerId: 'cust_789',
  notes: 'Net 30 payment terms',
});

// ── Issue the draft invoice (makes it available to the customer) ─
await client.invoices.issue(invoice.id);

// ── Mark as paid ────────────────────────────────────────────────
await client.invoices.markPaid(invoice.id, 'pay_completed_123');

// ── Cancel an invoice ───────────────────────────────────────────
await client.invoices.cancel(invoice.id);

// ── List invoices ───────────────────────────────────────────────
const { data: invoices } = await client.invoices.list({
  merchantId: 'merch_abc123',
  status: InvoiceStatus.ISSUED,
  page: 1,
  pageSize: 50,
});
```

### Escrow

Multi-milestone escrow for secure service transactions:

```ts
import { EPayClient, EscrowStatus, MilestoneStatus } from '@epay/sdk';

// ── Create an escrow with milestones ────────────────────────────
const escrow = await client.escrows.create({
  merchantId: 'merch_abc123',
  customerId: 'cust_789',
  amount: '10000000000',  // 10 XLM
  currency: 'XLM',
  milestones: [
    { index: 0, description: 'Requirements phase', amount: '3000000000' },
    { index: 1, description: 'Development phase', amount: '4000000000' },
    { index: 2, description: 'Delivery & QA',    amount: '3000000000' },
  ],
});

// ── Customer funds the escrow ───────────────────────────────────
await client.escrows.fund(escrow.id,
  '0xfunding_transaction_hash...',
);

// ── Complete a milestone (merchant submits work) ─────────────────
await client.escrows.completeMilestone(escrow.id, 0,
  '0xrelease_tx_hash...',
);

// ── Dispute resolution ──────────────────────────────────────────
await client.escrows.dispute(escrow.id);
await client.escrows.resolve(escrow.id);     // admin only
await client.escrows.cancel(escrow.id);

// ── List escrows ────────────────────────────────────────────────
const { data: escrows } = await client.escrows.list({
  merchantId: 'merch_abc123',
  status: EscrowStatus.IN_PROGRESS,
});
```

### Refunds

```ts
import { EPayClient, RefundStatus } from '@epay/sdk';

// ── Request a full refund ───────────────────────────────────────
const refund = await client.refunds.request({
  paymentId: 'pay_abc123',
  amount: '5000000000',
  reason: 'Customer not satisfied with product',
});

// ── Request a partial refund ────────────────────────────────────
const partial = await client.refunds.request({
  paymentId: 'pay_abc123',
  amount: '1000000000',
  reason: 'Partial refund for shipping delay',
});

// ── Approve / process / reject ──────────────────────────────────
await client.refunds.approve(refund.id);
await client.refunds.process(refund.id,
  '0xblockchain_refund_tx_hash...',
);
await client.refunds.reject(refund.id);

// ── List refunds ────────────────────────────────────────────────
const { data: refunds } = await client.refunds.list({
  paymentId: 'pay_abc123',
  status: RefundStatus.COMPLETED,
});
```

### Subscriptions

```ts
import { EPayClient, SubscriptionBillingInterval,
  SubscriptionStatus } from '@epay/sdk';

// ── Create a monthly subscription ───────────────────────────────
const sub = await client.subscriptions.create({
  merchantId: 'merch_abc123',
  customerId: 'cust_789',
  planName: 'Premium Plan',
  amount: '1000000000',      // 1 XLM / month
  currency: 'XLM',
  interval: SubscriptionBillingInterval.MONTHLY,
  trialDays: 7,
  maxPayments: 12,
});

// ── Manage lifecycle ────────────────────────────────────────────
await client.subscriptions.pause(sub.id);
await client.subscriptions.resume(sub.id);
await client.subscriptions.cancel(sub.id);

// ── List subscriptions ──────────────────────────────────────────
const { data: subscriptions } = await client.subscriptions.list({
  customerId: 'cust_789',
  status: SubscriptionStatus.ACTIVE,
});
```

### Merchants

```ts
import { EPayClient, MerchantStatus } from '@epay/sdk';

// ── Register a new merchant ─────────────────────────────────────
const merchant = await client.merchants.register({
  businessName: 'Acme Corp',
  businessEmail: 'payments@acme.dev',
  businessUrl: 'https://acme.dev',
  description: 'Decentralized widget store',
  supportedCurrencies: ['XLM', 'USDT'],
  settlementAddress: 'GAD_settlement_wallet...',
});

// ── Get your own merchant account ───────────────────────────────
const me = await client.merchants.getMyMerchant();

// ── Update profile ──────────────────────────────────────────────
await client.merchants.update(me.id, {
  businessName: 'Acme Corp (Updated)',
  description: 'New and improved widget store',
});

// ── List merchants (admin) ──────────────────────────────────────
const { data: merchants } = await client.merchants.list({
  status: MerchantStatus.ACTIVE,
  page: 1,
  pageSize: 50,
});

// ── Verify a merchant (admin) ───────────────────────────────────
await client.merchants.verify('merch_abc123', true, 'VERIFIED');
```

### Settlements

```ts
import { EPayClient, SettlementStatus } from '@epay/sdk';

// ── Create a settlement (aggregates completed payments) ──────────
const settlement = await client.settlements.create('merch_abc123');

console.log(`Gross: ${settlement.amount}`);
console.log(`Fee:   ${settlement.feeAmount}`);
console.log(`Net:   ${settlement.netAmount}`);

// ── Process the settlement on-chain ─────────────────────────────
await client.settlements.process(settlement.id,
  '0xsettlement_tx_hash...',
  'GAD_merchant_wallet...',
);

// ── List settlements ────────────────────────────────────────────
const { data: settlements } = await client.settlements.list({
  merchantId: 'merch_abc123',
  status: SettlementStatus.COMPLETED,
});
```

### Analytics

```ts
// ── Merchant analytics ──────────────────────────────────────────
const analytics = await client.analytics.getMerchantAnalytics(
  'merch_abc123',
  30, // last 30 days
);

console.log(`Total payments: ${analytics.totalPayments}`);
console.log(`Total volume:   ${analytics.totalVolume}`);
console.log(`Success rate:   ${analytics.successRate}%`);
console.log(`Refund rate:    ${analytics.refundRate}%`);

// ── Revenue breakdown ───────────────────────────────────────────
const revenue = await client.analytics.getMerchantRevenue(
  'merch_abc123',
  30,
);

// ── Platform analytics (admin) ──────────────────────────────────
const platform = await client.analytics.getPlatformAnalytics(30);
console.log(`Active merchants: ${platform.activeMerchants}`);
console.log(`Total volume:     ${platform.totalVolume}`);
```

---

## Wallet Integration

```ts
import { WalletClient, StellarNetwork } from '@epay/sdk';

const wallet = new WalletClient({
  network: StellarNetwork.TESTNET,
  horizonUrl: 'https://horizon-testnet.stellar.org',
});

// ── Validate a Stellar address ──────────────────────────────────
wallet.validateAddress('GAD_valid_address...');      // true
wallet.validateAddress('bad_address');                 // false

// ── Generate an auth message ────────────────────────────────────
const message = wallet.generateAuthMessage(
  'GAD_your_wallet_address...',
);
// => "EPay Authentication: Sign this message to prove you own
//     GAD_your_wallet_address...
//     Nonce: lz8xkq3a
//     Timestamp: 2026-08-05T12:00:00.000Z
//     Network: testnet"

// ── Build wallet auth from a signature ──────────────────────────
const auth = wallet.buildWalletAuth({
  address: 'GAD_your_wallet...',
  publicKey: 'GAD_public_key...',
  signature: 'wallet_signature...',
  message: message,
});

// ── Get wallet balance ──────────────────────────────────────────
const balanceStroops = await wallet.getBalance('GAD_your_wallet...');
console.log(`Balance: ${balanceStroops}`); // in stroops
```

### Using with Stellar Wallets

In a browser environment, integrate with Freighter or other Stellar wallets:

```ts
import { WalletClient, StellarNetwork } from '@epay/sdk';

const wallet = new WalletClient({ network: StellarNetwork.TESTNET });

// 1. Connect wallet (e.g. via Freighter)
const publicKey = await window.freighter?.getPublicKey();
if (!publicKey) throw new Error('Wallet not connected');

// 2. Generate auth message
const message = wallet.generateAuthMessage(publicKey);

// 3. Sign via wallet
// (implementation depends on wallet API)

// 4. Build auth payload
const auth = wallet.buildWalletAuth({
  address: publicKey,
  publicKey: publicKey,
  signature: '...',
  message,
});

// 5. Authenticate with EPay
const client = new EPayClient({ apiUrl: 'https://api.epay.dev' });
// Send auth to your backend to exchange for JWT
```

---

## Stellar Utilities

```ts
import {
  stroopsToXlm, xlmToStroops, isValidStellarPublicKey,
  formatAddress, getExplorerUrl, calculateFee,
  calculateNetAmount, StellarNetwork,
} from '@epay/sdk';

// ── stroops ↔ XLM conversion ────────────────────────────────────
stroopsToXlm('1000000000');    // "100"
stroopsToXlm('1500000000');    // "150"
stroopsToXlm('100');           // "0.00001"

xlmToStroops('100');           // "1000000000"
xlmToStroops('150');           // "1500000000"
xlmToStroops('0.00001');       // "100"

// ── Address utilities ───────────────────────────────────────────
isValidStellarPublicKey('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU');
// => true

formatAddress('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU');
// => "GAAAAAAA...AMAU"

getExplorerUrl('tx', 'tx_hash...', 'mainnet');
// => "https://stellar.expert/explorer/public/tx/tx_hash..."

getExplorerUrl('account', 'GAD...', 'testnet');
// => "https://stellar.expert/explorer/testnet/account/GAD..."

// ── Fee calculation ─────────────────────────────────────────────
calculateFee('1000000000', 50);   // "5000000"   (0.5% fee)
calculateFee('1000000000', 200);  // "20000000"  (2% fee)

calculateNetAmount('1000000000', 50); // "995000000" (after 0.5% fee)
```

---

## Error Handling

```ts
import { EPayError } from '@epay/sdk';

try {
  await client.payments.create({
    merchantId: 'invalid',
    amount: '1000000000',
    currency: 'XLM',
    recipientAddress: 'GAD...',
  });
} catch (error) {
  if (error instanceof EPayError) {
    console.error(`EPay API error [${error.statusCode}]: ${error.message}`);

    // Detailed field-level errors (validation)
    if (error.errors) {
      for (const e of error.errors) {
        console.error(`  ${e.field}: ${e.message}`);
      }
    }
  } else if (error instanceof Error && error.name === 'AbortError') {
    console.error('Request timed out');
  } else {
    console.error('Network error:', error);
  }
}
```

---

## Pagination

All `list()` methods return a `PaginatedResponse<T>`:

```ts
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Fetch all pages
let page = 1;
let allPayments = [];

while (true) {
  const result = await client.payments.list({ page, pageSize: 100 });
  allPayments.push(...result.data);
  if (!result.hasNext) break;
  page++;
}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EPAY_API_URL` | API base URL | `http://localhost:4000` |
| `EPAY_API_KEY` | Server-side API key | — |

Use these in your app to avoid hardcoding:

```ts
const client = new EPayClient({
  apiUrl: process.env.EPAY_API_URL,
  apiKey: process.env.EPAY_API_KEY,
});
```

---

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions. All request/response types, enums, and interfaces are exported for convenience:

```ts
import type {
  Payment, Invoice, Escrow, Refund, Subscription,
  Merchant, Settlement, PaymentAnalytics,
  PaginatedResponse, PaginationQuery,
  ApiResponse, AuthTokens, WalletAuth, User,
} from '@epay/sdk';

import {
  PaymentStatus, InvoiceStatus, EscrowStatus,
  RefundStatus, SubscriptionStatus, MerchantStatus,
  SettlementStatus, SubscriptionBillingInterval,
  StellarNetwork, MilestoneStatus, ApiPermission,
  NotificationChannel, TreasuryTxType, TreasuryTxStatus,
} from '@epay/sdk';
```

---

## Full API Reference

### Client

| Method | Signature |
|--------|-----------|
| `setApiKey(apiKey)` | Set API key for authentication |
| `setAccessToken(token)` | Set JWT access token |
| `clearAuth()` | Clear all authentication |
| `request<T>(method, path, body?, retries?)` | Low-level HTTP request |
| `get<T>(path)` | GET request |
| `post<T>(path, body?)` | POST request |
| `patch<T>(path, body?)` | PATCH request |
| `put<T>(path, body?)` | PUT request |
| `delete<T>(path)` | DELETE request |

### PaymentsResource

| Method | Description |
|--------|-------------|
| `create(request)` | Create a new payment |
| `getById(id)` | Get payment by ID |
| `list(params?)` | List payments (paginated, filterable) |
| `confirm(id, txHash)` | Confirm payment with blockchain tx |
| `complete(id)` | Mark payment as completed |
| `fail(id)` | Mark payment as failed |
| `cancel(id)` | Cancel pending payment |

### PaymentLinksResource

| Method | Description |
|--------|-------------|
| `create(request)` | Create shareable payment link |
| `getByCode(code)` | Look up link by short code |
| `listByMerchant(merchantId)` | List all links for a merchant |

### InvoicesResource

| Method | Description |
|--------|-------------|
| `create(request)` | Create draft invoice |
| `getById(id)` | Get invoice by ID |
| `list(params?)` | List invoices (paginated, filterable) |
| `issue(id)` | Issue draft invoice |
| `markPaid(id, paymentId)` | Mark invoice as paid |
| `cancel(id)` | Cancel invoice |

### EscrowsResource

| Method | Description |
|--------|-------------|
| `create(request)` | Create escrow with milestones |
| `getById(id)` | Get escrow by ID |
| `list(params?)` | List escrows (paginated, filterable) |
| `fund(id, txHash)` | Fund escrow with blockchain tx |
| `completeMilestone(id, index, releaseTxHash?)` | Complete a milestone |
| `dispute(id)` | File a dispute |
| `resolve(id)` | Resolve a dispute (admin) |
| `cancel(id)` | Cancel escrow |

### RefundsResource

| Method | Description |
|--------|-------------|
| `request(request)` | Request a refund |
| `getById(id)` | Get refund by ID |
| `list(params?)` | List refunds (paginated, filterable) |
| `approve(id)` | Approve refund request |
| `process(id, txHash)` | Process refund on-chain |
| `reject(id)` | Reject refund request |

### SubscriptionsResource

| Method | Description |
|--------|-------------|
| `create(request)` | Create subscription |
| `getById(id)` | Get subscription by ID |
| `list(params?)` | List subscriptions (paginated, filterable) |
| `pause(id)` | Pause active subscription |
| `resume(id)` | Resume paused subscription |
| `cancel(id)` | Cancel subscription |

### MerchantsResource

| Method | Description |
|--------|-------------|
| `register(request)` | Register new merchant |
| `getMyMerchant()` | Get authenticated merchant |
| `getById(id)` | Get merchant by ID |
| `list(params?)` | List merchants (admin) |
| `update(id, data)` | Update merchant profile |
| `verify(id, approve, level?)` | Verify merchant (admin) |

### SettlementsResource

| Method | Description |
|--------|-------------|
| `create(merchantId)` | Create settlement |
| `getById(id)` | Get settlement by ID |
| `list(params?)` | List settlements (paginated, filterable) |
| `process(id, txHash, address)` | Process settlement on-chain |

### AnalyticsResource

| Method | Description |
|--------|-------------|
| `getMerchantAnalytics(merchantId, days?)` | Merchant payment analytics |
| `getMerchantRevenue(merchantId, days?)` | Merchant revenue breakdown |
| `getPlatformAnalytics(days?)` | Platform-wide analytics (admin) |

### WalletClient

| Method | Description |
|--------|-------------|
| `generateAuthMessage(address)` | Generate auth message to sign |
| `buildWalletAuth(signature)` | Build WalletAuth from signature |
| `validateAddress(address)` | Validate Stellar address |
| `getBalance(address)` | Get wallet balance (stroops) |

### Utilities

| Function | Description |
|----------|-------------|
| `stroopsToXlm(stroops)` | Convert stroops → human XLM |
| `xlmToStroops(xlm)` | Convert human XLM → stroops |
| `isValidStellarPublicKey(addr)` | Validate Stellar address format |
| `formatAddress(addr, prefix?, suffix?)` | Truncate address for display |
| `getExplorerUrl(type, value, network?)` | Get Stellar Expert URL |
| `calculateFee(amount, feeBps?)` | Calculate EPay fee |
| `calculateNetAmount(amount, feeBps?)` | Calculate net after fee |

---

## License

MIT
