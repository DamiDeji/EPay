# Performance & Service Level Objectives

What "fast enough" means for EPay, how it is measured, and what happens when it
is not met.

A payments product has a narrow acceptable latency band: a customer waiting at a
checkout will retry or abandon, and a merchant watching a settlement will file a
ticket. The numbers below are the contract between the platform and its users,
and each one is wired to an alert in
[`monitoring/prometheus/rules/epay.yml`](../monitoring/prometheus/rules/epay.yml)
so a regression is detected before a customer reports it.

## SLOs

| Surface                | SLI                              | Target           | Window | Alert                                            |
| ---------------------- | -------------------------------- | ---------------- | ------ | ------------------------------------------------ |
| **API availability**   | non-5xx / total requests         | **≥ 99.9%**      | 30d    | `EpayApiHigh5xxRate` (> 2% for 5m)               |
| **API latency (read)** | server-side p95                  | **< 300 ms**     | 30d    | —                                                |
| **API latency (read)** | server-side p99                  | **< 1 s**        | 30d    | `EpayApiP99LatencyHigh` (> 2s for 10m)           |
| **Payment write**      | server-side p95                  | **< 500 ms**     | 30d    | —                                                |
| **DB pool wait**       | p99 wait to acquire a connection | **< 500 ms**     | 30d    | `EpayDbPoolWaitHigh` (> 500ms for 10m)           |
| **Query latency**      | p99 per query                    | **< 1 s**        | 30d    | `EpaySlowQueryP99High` (> 1s for 10m)            |
| **Indexer lag**        | ledger head − checkpoint         | **< 30 ledgers** | 7d     | `EpayQueueLagHigh` (waiting jobs > 1000 for 10m) |
| **Webhook delivery**   | delivered within the schedule    | **≥ 99%**        | 7d     | — (dead letters surfaced in the DB)              |
| **Readiness**          | replicas passing `/health/ready` | **100%**         | 1h     | `EpayReadinessProbeFailing`                      |

Targets are deliberately stated as **server-side** latency. Client-side numbers
include the customer's network and wallet, which EPay does not control; alerting
on them produces noise, not signal.

### Error budget

With a 99.9% availability target over 30 days there are **~43 minutes** of allowed
downtime (0.1% of 43,200 minutes) and a matching 0.1% error budget.

| Budget consumed | Policy                                                                                 |
| --------------- | -------------------------------------------------------------------------------------- |
| < 50%           | Ship normally.                                                                         |
| 50–100%         | No risky changes without an explicit maintainer sign-off; prioritise reliability work. |
| 100%            | **Feature freeze.** The next deploy is a reliability fix.                              |

The budget is not a target to spend — it is a tripwire. If a month passes with 0%
consumed, the SLO is probably looser than the product needs, and we tighten it.

## Load profile

`tests/k6/load-tests.js` is the load generator; `tests/k6/README.md` has the
runbook. The default profile ramps virtual users, holds a steady state, then ramps
down, and asserts the thresholds below — the run fails if an SLO is breached, so
it can gate a release rather than just produce a graph.

| Metric                  | Threshold (k6) |
| ----------------------- | -------------- |
| `http_req_failed`       | < 5%           |
| `http_req_duration` p90 | < 300 ms       |
| `http_req_duration` p95 | < 500 ms       |
| `http_req_duration` p99 | < 1000 ms      |
| payment success rate    | > 95%          |

### Running a load test

```bash
# Local, default profile
API_URL=http://localhost:4000 k6 run tests/k6/load-tests.js

# Staging with an API key, 100 VUs for 3 minutes
API_URL=https://api.staging.epay.dev API_KEY=$EPAY_API_KEY \
  k6 run --vus 100 --duration 3m tests/k6/load-tests.js

# Spike: does the HPA react fast enough?
k6 run --vus 50 --duration 10s tests/k6/load-tests.js
```

**Never point a load test at production.** It is a denial-of-service tool with a
graph. Use staging, or a local stack seeded with realistic data.

### What to watch during a run

Open the Grafana **EPay — Platform Health** dashboard alongside k6. The k6
summary tells you _that_ a threshold failed; the dashboard tells you _why_:

| Symptom in k6                    | Likely cause                                               | Look at                                 |
| -------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| p99 up, throughput flat          | a slow query or missing index                              | `EpaySlowQueryP99High`, query breakdown |
| p99 up with rising pool wait     | connection pool too small, or a query holding a connection | `EpayDbPoolWaitHigh`                    |
| errors up, latency flat          | 429s from throttling, or a downstream failure              | status-code breakdown                   |
| latency flat, errors at the tail | one bad replica                                            | readiness / replica count               |

## Capacity

| Resource         | Current                      | Scaling signal                                                             |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------- |
| API replicas     | 2–10 (HPA, 70% CPU)          | CPU; 10 is a deliberate ceiling because the connection pool is per-replica |
| Indexer replicas | 1 (singleton)                | must stay 1 — only one process may hold the checkpoint lease               |
| DB connections   | `replicas × pool size`       | watch `EpayDbPoolWaitHigh` before raising either                           |
| Indexer          | 1 process, 1 batch at a time | `epay_indexer_ledger_lag` and batch duration                               |

Raising `maxReplicas` without raising the database's `max_connections` converts a
throughput problem into a pool-exhaustion outage. The two must move together.

## Known limitations

- The load test exercises the **API surface**, not the on-chain path; Stellar
  testnet latency and Soroban resource limits are not represented.
- Latency targets are for `us-east-1`-adjacent clients. Multi-region deployment is
  not implemented; a distant client will see the network RTT on top of these
  numbers.
- No formal soak test (24h+) has been run. A long-running soak would catch
  connection leaks and slow memory growth that a 10-minute run cannot.

## See also

- [`monitoring/README.md`](../monitoring/README.md) — dashboards and alert routing
- [`docs/architecture.md`](./architecture.md) — where latency is introduced
- [`docs/disaster-recovery.md`](./disaster-recovery.md) — RTO/RPO targets
