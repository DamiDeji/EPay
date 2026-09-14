# Integrating with EPay

A guide for partners building on EPay: pick an integration path, authenticate,
take a payment, and handle the edge cases that decide whether an integration is
production-grade.

> **Terminology.** "Contract integration" here means integrating with the EPay
> *platform contract* (its API and on-chain contracts) from your application. If
> you are a **merchant**, you may not need any code at all — payment links and the
> merchant dashboard cover most cases.

## Choose a path

| Path | Best for | Status |
| --- | --- | --- |
| **[TypeScript SDK](#typescript-sdk)** (`@epay/sdk`) | Node services, Next.js apps, scripts | ✅ Available |
| **[REST API](#rest-api)** + [webhooks](./webhook-receiver.md) | Any language, minimal dependencies | ✅ Available |
| **Wallet + Soroban directly** | Non-custodial flows where you sign transactions yourself | ✅ Contracts are public; see [`packages/contracts/README.md`](../packages/contracts/README.md) |
| **Go / Python SDKs** | — | 🔜 **Not provided.** Use the REST API; the wire format is documented and the webhook verifier is ~20 lines in any language. See [ROADMAP](../ROADMAP.md). |

Everything below is tested against the public testnet and the local stack from
[getting-started.md](./getting-started.md).

---

## TypeScript SDK

```bash
pnpm add @epay/sdk
```

```ts
import { EPayClient, PaymentStatus } from '@epay/sdk';

const epay = new EPayClient({
  apiUrl: process.env.EPAY_API_URL ?? 'https://api.epay.dev',
  apiKey: process.env.EPAY_API_KEY!,   // server-side only — never ship this to a browser
});
```

### Take a payment

The three steps are *create → customer pays → confirm*. The middle step happens in
the customer's wallet; your server never holds a key.

```ts
// 1. Create the payment request.
const payment = await epay.payments.create({
  merchantId: 'merch_abc123',
  amount: '5000000000',                     // stroops: 5 XLM (1 XLM = 10^7)
  currency: 'XLM',
  recipientAddress: 'GAD...',               // your merchant settlement address
  description: 'Order #1234',
  expiresIn: 3600,
  metadata: { orderId: 'ord_1234' },        // returned to you on every webhook
});

// 2. Hand `payment.paymentId` to your client, which builds and signs the
//    Stellar transaction (Freighter, xBull, Albedo, …).

// 3. Once the transaction is submitted, attach the hash.
await epay.payments.confirm(payment.paymentId, txHash);
```

Do **not** poll for confirmation in a request handler. Subscribe to the
`payment.completed` webhook instead (below), and treat `confirm` as the point at
which you *told* EPay about the transaction, not proof that it settled.

### Invoice a business customer

```ts
const invoice = await epay.invoices.create({
  merchantId: 'merch_abc123',
  amount: '7500000000',
  currency: 'XLM',
  items: [
    { description: 'Implementation', quantity: 1, unitPrice: '5000000000', total: '5000000000' },
    { description: 'Support (1 year)', quantity: 1, unitPrice: '2500000000', total: '2500000000' },
  ],
  dueDate: new Date(Date.now() + 30 * 86_400_000),
  customerId: 'cust_789',
});

await epay.invoices.issue(invoice.id);   // draft → issued, now payable
```

### Escrow a milestone-based engagement

Escrow is the right tool when the payer wants protection: funds are held by the
contract, not by EPay, and released on completion.

```ts
const escrow = await epay.escrows.create({
  merchantId: 'merch_abc123',
  customerId: 'cust_789',
  amount: '10000000000',
  currency: 'XLM',
  milestones: [
    { index: 0, description: 'Discovery', amount: '3000000000' },
    { index: 1, description: 'Build',     amount: '4000000000' },
    { index: 2, description: 'Handover',  amount: '3000000000' },
  ],
});

await epay.escrows.fund(escrow.id, fundingTxHash);
await epay.escrows.completeMilestone(escrow.id, 0, releaseTxHash);
```

A dispute (`escrow.dispute(id)`) must be resolved by an EPay admin
(`escrow.resolve(id)`); design your UX so both parties know that.

### Refund

```ts
const refund = await epay.refunds.request({
  paymentId: 'pay_abc123',
  amount: '1000000000',        // partial; omit or set equal to the original for a full refund
  reason: 'Item returned',
});
// Admin approval is required; watch `refund.completed`.
```

### Recurring billing

```ts
const sub = await epay.subscriptions.create({
  merchantId: 'merch_abc123',
  customerId: 'cust_789',
  planName: 'Pro',
  amount: '1000000000',
  currency: 'XLM',
  interval: 'MONTHLY',
  trialDays: 7,
});
```

---

## REST API

Every SDK call is an HTTP call. If you are not in TypeScript, use the REST API
directly and verify webhooks with the recipe in
[`webhook-receiver.md`](./webhook-receiver.md).

```bash
# Authenticate (JWT) — for user-scoped actions.
curl -s -X POST "$EPAY_API_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' | jq -r .data.accessToken

# Or use an API key for server-to-server calls.
curl -s "$EPAY_API_URL/payments?merchantId=merch_abc123" \
  -H "x-api-key: $EPAY_API_KEY"
```

- **Base URL:** `https://api.epay.dev` (production) or your own deployment
- **Auth:** `Authorization: Bearer <jwt>` **or** `x-api-key: <key>`
- **Content type:** `application/json`
- **Interactive reference:** `GET /api/docs` (Swagger) on any deployment

### Idempotency

Any state-creating `POST` should carry an idempotency key so a retried request
(flaky network, double-click, queue redelivery) does not create two payments:

```bash
curl -s -X POST "$EPAY_API_URL/payments" \
  -H "x-api-key: $EPAY_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: ord_1234-create' \
  -d '{ "merchantId": "merch_abc123", "amount": "5000000000", "currency": "XLM" }'
```

Generate the key from the *business* operation (`{orderId}-create`), not from a
random value per attempt — a random key on each retry defeats the purpose.

### Errors

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "amount", "code": "MIN_VALUE", "message": "must be greater than 0" }],
  "timestamp": "2026-09-14T09:00:00.000Z"
}
```

| Status | Meaning | Retry? |
| --- | --- | --- |
| `400` | Validation error — fix the request | No |
| `401` / `403` | Missing or invalid credentials, or insufficient role | No |
| `404` | Unknown id | No |
| `409` | Conflict (already completed, duplicate idempotency key) | No |
| `429` | Rate limited — honour `Retry-After` | Yes, with backoff |
| `5xx` | Server error | Yes, with backoff + idempotency key |

Every response carries an `x-request-id`. **Log it.** It is the fastest way to get
a useful answer from EPay support.

---

## Webhooks: the part that decides your architecture

Webhooks, not polling, are how you learn that money moved. They are signed, retried
on a documented backoff, and dead-lettered rather than dropped. The full receiver
contract — header format, three-language verification examples, retry schedule, and
idempotency — is in **[webhook-receiver.md](./webhook-receiver.md)**.

The three rules that matter most:

1. **Verify the signature against the raw body bytes.** Re-serialising JSON breaks it.
2. **Deduplicate on `X-EPay-Event-Id`.** You *will* see an event twice.
3. **Persist before responding `200`.** A fast `200` with nothing stored is data loss.

---

## Testing your integration

### Against testnet

1. Register a merchant on the testnet dashboard.
2. Fund a test wallet from the [Stellar testnet friendbot](https://laboratory.stellar.org/#account-creator?network=testnet).
3. Use the testnet contract addresses in [`.env.example`](../.env.example) /
   [`DEPLOYMENTS.md`](../DEPLOYMENTS.md).

Testnet is reset periodically and its assets are worthless — never treat a testnet
success as evidence of a production-correct integration.

### The failure paths to test before launch

| Scenario | What you should observe |
| --- | --- |
| Duplicate webhook delivery (replay it by hand) | Your handler is idempotent; no second refund/shipment |
| Webhook signature tampered | Your handler returns 401 and does nothing |
| Receiver down for 30 minutes | EPay retries; you receive the event once back up |
| Receiver down for a day | The delivery is dead-lettered; you can replay it from `GET /webhooks/deliveries` |
| API returns `429` | Your client backs off instead of hammering |
| Payment expires unpaid | You see `payment.failed` and cancel the order |

## Support

- **Bugs and questions:** GitHub Issues on [`DamiDeji/EPay`](https://github.com/DamiDeji/EPay/issues)
- **Security:** never a public issue — use [Security Advisories](../SECURITY.md)
