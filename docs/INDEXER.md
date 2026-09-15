# Indexer

`apps/indexer` reads EPay's Soroban contract events and persists them durably.

This document describes what the indexer **actually does**, and — in
[Not yet implemented](#not-yet-implemented-read-model-projections) — the one
thing it deliberately does not do, with the exact reason.

## Where events come from

Contract events are served by **Soroban RPC `getEvents`**. They are _not_
available from Horizon's transaction or operation endpoints, so the scanner does
not use Horizon at all. Each event arrives as:

```json
{
  "id": "0000123456-0000000001",
  "ledger": 1234567,
  "ledgerClosedAt": "2026-09-15T12:00:00Z",
  "contractId": "C…",
  "type": "contract",
  "topic": ["AAAADgAAAA9wYXltZW50X2NyZWF0ZWQA"],
  "value": "AAAAEQAAAAEAAAABAAAADwAAAAEAAAAAAAAAAQ==",
  "txHash": "…",
  "inSuccessfulContractCall": true
}
```

`topic[0]` is the event name as a `Symbol`; `value` is the data tuple. Both are
base64 XDR and are decoded with `xdr.ScVal.fromXdr(…, 'base64')` and
`scValToNative`. See `apps/indexer/src/blockchain/contracts.ts`.

## Event catalogue

`CONTRACT_SPECS` in `blockchain/contracts.ts` lists all 16 contracts, the
environment variable holding each deployed contract id, and every event each
contract emits with its **field names in order**. It mirrors
[`packages/contracts/EVENTS.md`](../packages/contracts/EVENTS.md); a contract
change that adds or renames an event must update both in the same pull request.

Two behaviours matter:

- An event the catalogue does not know is still recorded, with `known: false`
  and positional `arg0…argN` field names. A contract upgrade that adds an event
  shows up in the log instead of vanishing.
- An event whose payload arity contradicts the catalogue raises
  `EventDecodeError`, which is **counted and reported, not thrown away**. One
  malformed event cannot stall a ledger.

Events from a failed contract call (`inSuccessfulContractCall: false`) and
`diagnostic`/`system` events are ignored: a rolled-back call's events describe
state that never existed.

## Guarantees

### Idempotency

Every decoded event is written to `indexer_events`, which is unique on the
on-chain `eventId`. Recording the same event twice — a retried job, a
re-scanned range, two replicas, a restart mid-batch — is a no-op that returns
`duplicate`. This is what makes a retry safe rather than merely unlikely.

### No skipped ledgers

The checkpoint (`indexer_state.last_indexed_block`) advances **only** after every
event in a range is durable. On failure the batch is retried in place; if it
keeps failing the run **aborts**, leaving the checkpoint on the last contiguous
good batch. It never logs a failure and moves on, because the next successful
`finalize` would then skip those ledgers forever.

### Restart safety

On startup the checkpoint is loaded before any scanning, so a restart resumes
exactly where the last committed batch ended. A corrupted checkpoint value
(non-numeric, negative) is treated as "no checkpoint" and reported rather than
propagated into ledger arithmetic.

### Monotonic checkpoint

`finalize` refuses to move the checkpoint backwards. Stellar finalises quickly
and the indexer only scans the confirmed region, so a backwards move means a
corrupted caller or a reorg deeper than `INDEXER_CONFIRMATION_LEDGERS`; both need
an operator decision rather than a silent rewind.

### Honest failures

`getChainTip()` propagates an RPC outage instead of returning a guessed height. A
fabricated tip makes the indexer look caught up while it is not.

## Flow

```
Soroban RPC getEvents ──▶ BlockScanner.scanRange
                             │  decode via CONTRACT_SPECS
                             ▼
                        dispatchEvent ──▶ indexer_events (unique eventId)
                             │
                             ▼
                   CheckpointManager.finalize  (only after all events are durable)
```

`HistoricalSync` walks from the checkpoint to `tip − confirmationLedgers` and
then hands over to `RealtimeSync`, which polls for new confirmed ledgers and
backs off exponentially on repeated failures (capped at 120s so recovery stays
prompt). Both engines process events directly and synchronously: a queue would
let the checkpoint advance ahead of the work, which is precisely the failure mode
the ledger-skipping bug produced.

## Metrics

Served on `METRICS_PORT` (4100) at `/metrics`, which is where
`monitoring/prometheus/prometheus.yml` already scrapes from.

| Metric                                | Meaning                                          |
| ------------------------------------- | ------------------------------------------------ |
| `epay_indexer_ledger_lag`             | Chain tip − last processed ledger                |
| `epay_indexer_chain_tip_ledger`       | Latest ledger reported by Soroban RPC            |
| `epay_indexer_last_processed_ledger`  | Highest checkpointed ledger                      |
| `epay_indexer_events_total`           | Events by contract, event name and outcome       |
| `epay_indexer_decode_failures_total`  | Events that could not be decoded                 |
| `epay_indexer_rpc_requests_total`     | RPC calls by method and outcome                  |
| `epay_indexer_scan_duration_seconds`  | Time to fetch and decode one range               |
| `epay_indexer_batch_duration_seconds` | Time to process one batch end to end             |
| `epay_indexer_uptime_seconds`         | Process uptime (a restart is visible on a graph) |

`epay_indexer_ledger_lag` is the series plotted by
`monitoring/grafana/dashboards/epay-queue-lag.json`. Renaming a metric silently
empties a dashboard panel.

Note that in steady state the lag settles at `INDEXER_CONFIRMATION_LEDGERS`
(default 12), because the indexer deliberately stops short of the tip. Any alert
threshold must be above the buffer.

### Probes

- `GET /health` — liveness. Returns 200 while the initial catch-up is still
  running: a pod that is backfilling is healthy, and returning 503 would make
  Kubernetes restart a working indexer in a loop.
- `GET /ready` — readiness. 503 until the historical sync completes.
- `GET /metrics` — Prometheus exposition.

These match the deployed manifests, which probe `/health` on the `metrics`
container port.

## Reconciliation

`reconciliation.ts` exposes the invariant an operator can check at any time:

> every ledger below `last_indexed_block` had all of its events recorded, and
> every recorded event has `appliedAt` set.

`reconcile(prisma)` reports the last indexed ledger, total events, and the count
and oldest ledger of unapplied work. A non-zero unapplied count after a clean run
means a batch died between writing events and checkpointing, which the next run
replays.

## Configuration

| Variable                       | Default                               | Notes                                    |
| ------------------------------ | ------------------------------------- | ---------------------------------------- |
| `STELLAR_SOROBAN_RPC_URL`      | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint                     |
| `*_CONTRACT_ID`                | _(unset)_                             | One per contract; unset = not subscribed |
| `INDEXER_START_LEDGER`         | `0`                                   | Used when no checkpoint exists           |
| `INDEXER_BATCH_SIZE`           | `100`                                 | Ledgers per batch                        |
| `INDEXER_POLL_INTERVAL_MS`     | `10000`                               | Real-time poll interval                  |
| `INDEXER_CONFIRMATION_LEDGERS` | `12`                                  | Ledgers to stay behind the tip           |
| `INDEXER_HISTORICAL_ENABLED`   | `true`                                | `false` skips the catch-up phase         |
| `INDEXER_REALTIME_ENABLED`     | `true`                                | `false` skips the tail                   |
| `METRICS_PORT`                 | `4100`                                | `/metrics`, `/health`, `/ready`          |
| `INDEXER_METRICS_ENABLED`      | `true`                                | `false` disables the HTTP server         |

With no `*_CONTRACT_ID` set the indexer subscribes to nothing and says so at
startup.

## Testing

```bash
pnpm --filter @epay/indexer test           # 114 tests
pnpm --filter @epay/indexer test:coverage  # thresholds: lines ≥ 90, branches ≥ 80
```

The suite covers XDR decoding of real Soroban values, unknown and malformed
events, paging, RPC retry/backoff/rate limits, checkpoint recovery from corrupted
values, checkpoint rewind refusal, batch retry-in-place, ledger-skip prevention,
idempotent replay, metrics exposition, probes and reconciliation. Fixtures are
encoded with the Stellar SDK rather than hand-written base64, so the decoder is
tested against the same serialisation a validator produces.

## Not yet implemented: read-model projections

**The indexer records events; it does not project them onto `payments`,
`escrow`, `refunds` or `subscriptions`.** This is deliberate, and here is the
exact reason.

A projection needs a key that ties an on-chain id to an off-chain row. EPay does
not have one:

1. `PaymentRouter` emits `payment_created` carrying a `u64` payment id, while
   `apps/api/src/payment/payment.service.ts` mints an unrelated random string
   (`generateId('pay')`). None of `Payment`, `Escrow`, `Refund`, `Subscription`,
   `Invoice`, `Merchant` or `Settlement` has a column holding the on-chain id.
2. Nothing in the API submits a Soroban transaction in the first place. The only
   use of `@stellar/stellar-sdk` outside the contracts is `Keypair` signature
   verification in `apps/api/src/auth/auth.service.ts`. So there is no
   transaction for a correlating id to be recorded from.

Writing a projection anyway would mean guessing a `merchantId` from an address or
matching a random string against a ledger sequence — marking rows `CONFIRMED` on
the strength of a coincidence. That is exactly the fabricated-success behaviour
this repository forbids, so the indexer does the honest thing instead: it decodes
and stores every event exactly once, which is both the reconciliation source of
truth and the input a future projection needs.

### What closing the gap requires

1. An on-chain submission path in the API that builds, signs and submits the
   `create_payment` / `create_escrow` / … calls.
2. A correlation column per aggregate (`Payment.contractPaymentId String?
@unique`, and equivalents) written when the submission is made, plus a
   migration.
3. Projection handlers keyed on that column, added to `dispatchEvent`, with a
   test per event that feeds a fixture through the handler twice to prove the
   second pass changes nothing.

Severity: **HIGH** — it is the difference between "indexes the chain" and
"mirrors on-chain state into the read model". It is a product-integration gap,
not a data-integrity defect in what is built today.
