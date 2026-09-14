# Webhook Receiver Contract

Everything a partner needs to receive, verify, and durably process EPay webhooks.

EPay POSTs a JSON body to the `webhookUrl` configured on your merchant account
whenever something happens to a payment, invoice, escrow, refund, subscription,
or settlement. **Treat the body as untrusted until the signature verifies**, and
**never act on a delivery more than once**.

- **Content-Type:** `application/json`
- **Method:** `POST`
- **Signing:** HMAC-SHA256 over `"{timestamp}.{rawBody}"`
- **Retries:** 6 attempts over ~8.5 hours, then dead-lettered
- **Idempotency key:** `X-EPay-Event-Id`, stable across every retry

## Headers

| Header | Example | Meaning |
| --- | --- | --- |
| `X-EPay-Signature` | `t=1700000000,v1=5257a869…` | Unix timestamp and HMAC signature |
| `X-EPay-Event-Id` | `evt_01HA…` | Stable id for this event; your dedupe key |
| `X-EPay-Event-Type` | `payment.completed` | The event name |
| `X-Request-Id` | `6f1c…` | EPay's request id, for support |
| `User-Agent` | `EPay-Webhooks/1.0` | Constant |

## Signing scheme

The `X-EPay-Signature` header is GitHub-style:

```text
X-EPay-Signature: t=1700000000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

- `t` — Unix timestamp (seconds) **at signing time**, also part of the signed input.
- `v1` — `hex(HMAC-SHA256(secret, "{t}.{rawBody}"))`.

Because `t` is inside the signed input, nobody can change it without invalidating
the signature. Multiple `v1` values may appear during secret rotation; accept the
request if **any** matches.

> **Sign the bytes, not the object.** Verify against the exact request body you
> received. If your framework re-serialises JSON before you can read the raw
> bytes, you will get a different string and every signature will fail. Capture
> the raw body first (e.g. `express.raw()` or Fastify's `addContentTypeParser`).

### Reference implementation

The authoritative implementation lives in
[`packages/shared/src/webhook-signature.ts`](../packages/shared/src/webhook-signature.ts)
(`@epay/shared/webhook-signature`). The snippets below mirror it.

#### TypeScript / Node

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import express from 'express';

const SECRET = process.env.EPAY_WEBHOOK_SECRET!;
const TOLERANCE_SECONDS = 300; // reject anything older/newer than 5 minutes

function verify(rawBody: string, header: string): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.split('=', 2) as [string, string]),
  );
  const timestamp = Number.parseInt(parts.t ?? '', 10);
  const provided = parts.v1;
  if (!Number.isFinite(timestamp) || !provided) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const app = express();
app.post(
  '/webhooks/epay',
  express.raw({ type: 'application/json' }), // keep the raw bytes
  (req, res) => {
    const raw = req.body.toString('utf8');
    if (!verify(raw, String(req.header('x-epay-signature') ?? ''))) {
      return res.status(401).json({ error: 'invalid signature' });
    }

    const eventId = String(req.header('x-epay-event-id'));
    if (alreadyProcessed(eventId)) return res.status(200).json({ ok: true }); // dedupe

    const event = JSON.parse(raw);
    enqueue(event); // persist BEFORE responding
    return res.status(200).json({ ok: true });
  },
);
```

#### Python

```python
import hashlib, hmac, time
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["EPAY_WEBHOOK_SECRET"]
TOLERANCE = 300

@app.post("/webhooks/epay")
def epay_webhook():
    raw = request.get_data(as_text=True)          # raw bytes as text
    header = request.headers.get("X-EPay-Signature", "")
    parts = dict(part.split("=", 1) for part in header.split(",") if "=" in part)

    ts = int(parts.get("t", "0"))
    if abs(time.time() - ts) > TOLERANCE:
        abort(401)
    expected = hmac.new(SECRET.encode(), f"{ts}.{raw}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(parts.get("v1", ""), expected):
        abort(401)

    event_id = request.headers["X-EPay-Event-Id"]
    if already_processed(event_id):
        return {"ok": True}
    enqueue(request.get_json())
    return {"ok": True}
```

#### Go

```go
func verify(rawBody, header, secret string) bool {
	parts := map[string]string{}
	for _, p := range strings.Split(header, ",") {
		kv := strings.SplitN(p, "=", 2)
		if len(kv) == 2 {
			parts[kv[0]] = kv[1]
		}
	}
	ts, err := strconv.ParseInt(parts["t"], 10, 64)
	if err != nil || !fresh(ts, 300) {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "%d.%s", ts, rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(parts["v1"]), []byte(expected))
}
```

## Responding

| Response | EPay's behaviour |
| --- | --- |
| Any `2xx` | Delivered. The delivery is marked succeeded and never retried. |
| `4xx` (other than 429) | Treated as a failure and retried — a bug on your side should not silently drop an event. |
| `429`, or any `5xx` | Retried on the backoff schedule. |
| Timeout (> 10s) | Treated as a failure and retried. |

**Respond fast.** Do the minimum in the request: verify, persist to a queue or
table, return `200`. Process asynchronously. A slow handler burns your retry
budget and delays every other event.

Returning `2xx` before you have durably stored the event risks losing it — the
retry will not come.

## Retry schedule and dead-lettering

Failures are retried with exponential backoff:

| Attempt | Delay before this attempt |
| --- | --- |
| 1 (initial) | immediate |
| 2 | 30 s |
| 3 | 2 min |
| 4 | 10 min |
| 5 | 30 min |
| 6 | 2 h |
| 7 | 6 h |

After the 7th attempt fails, the delivery is **dead-lettered**: it stays in EPay's
`webhook_deliveries` table with `deadLetteredAt` set and is available from
`GET /webhooks/deliveries?deadLettered=true` for inspection and manual replay. It
is never silently dropped.

**Design your receiver to be idempotent.** You may receive an event more than once
— a `200` can be lost in transit, or your process can crash after committing but
before responding.

## Idempotency and replay protection

Two independent mechanisms protect against duplicates and replays:

1. **`X-EPay-Event-Id`** is stable across retries. Key your dedupe store on it
   (a unique index or a Redis `SET NX` with a TTL), and return `200` without
   reprocessing a repeat.
2. **Timestamp freshness.** Reject any request whose `t` is more than 5 minutes
   from your clock (`WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS`). This is signed, so it
   cannot be forged, and it bounds the window in which a captured request could be
   replayed.

On the sender side, EPay additionally refuses to create a second delivery for the
same `(merchant, eventId)`, so duplicates do not originate here.

A practical receiver keys dedupe storage on `eventId` with a retention window of
at least 24 hours — comfortably longer than the longest backoff interval (6 h).

## Secret rotation

Secrets are per-merchant (`Merchant.webhookSecret`). Rotate by:

1. Generating a new secret and configuring your receiver to accept **both** old
   and new (the header may carry two `v1=` values).
2. Updating the secret in the merchant dashboard / API.
3. Removing the old secret once no in-flight deliveries use it.

During rotation the sender signs with the new secret only, so a receiver that
still only knows the old secret will see failures — accept both before switching.

## Event types

| Event | Fired when |
| --- | --- |
| `payment.created` | A payment request is recorded |
| `payment.completed` | Funds have settled to the merchant |
| `payment.failed` | The payment failed or expired |
| `payment.refunded` | A payment was refunded |
| `invoice.issued` | An invoice was sent |
| `invoice.paid` | An invoice was paid |
| `invoice.overdue` | An invoice passed its due date |
| `escrow.created` | An escrow was opened |
| `escrow.funded` | The customer funded the escrow |
| `escrow.completed` | Funds were released to the merchant |
| `escrow.disputed` | A dispute was raised |
| `refund.completed` | A refund reached the payer |
| `subscription.renewed` | A subscription period was billed |
| `settlement.completed` | A settlement batch was paid out |

The complete on-chain event catalogue that drives these (with exact payloads) is
in [`packages/contracts/EVENTS.md`](../packages/contracts/EVENTS.md).

## Local testing

```bash
export EPAY_WEBHOOK_SECRET=whsec_test_2f5a1c
export EPAY_WEBHOOK_URL=http://localhost:4001/webhooks/epay
npx epay-webhook-listen   # or point your tunnel at the endpoint
```

Generate a signature by hand to test your verifier:

```bash
TS=$(date +%s)
BODY='{"id":"evt_1","type":"payment.completed"}'
printf '%s.%s' "$TS" "$BODY" \
  | openssl dgst -sha256 -hmac "$EPAY_WEBHOOK_SECRET" -r \
  | awk '{print "t='"$TS"',v1="$1}'}
```

## See also

- [`packages/shared/src/webhook-signature.ts`](../packages/shared/src/webhook-signature.ts) — reference implementation and constants
- [`docs/architecture.md`](./architecture.md) — where webhooks sit in the data flow
- [`docs/disaster-recovery.md`](./disaster-recovery.md) — what happens to queued webhooks during an incident
