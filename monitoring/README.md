# EPay Observability

Prometheus + Grafana + Alertmanager for the EPay API, indexer, BullMQ queues, and
PostgreSQL.

## Run it

```bash
# 1. Provide the scrape token the API/indexer validate (must match METRICS_TOKEN).
mkdir -p monitoring/secrets
printf '%s' "$METRICS_TOKEN" > monitoring/secrets/metrics_token

# 2. Start everything.
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

| Service | URL | Notes |
| --- | --- | --- |
| Grafana | http://localhost:3003 | `admin` / `$GRAFANA_ADMIN_PASSWORD` (default `admin`) |
| Prometheus | http://localhost:9090 | scrape targets + rule evaluation |
| Alertmanager | http://localhost:9093 | routing, silences, inhibition |
| Pushgateway | http://localhost:9091 | backup / restore-drill heartbeats |

## What gets scraped

`prometheus/prometheus.yml` defines six jobs:

| Job | Target | Purpose |
| --- | --- | --- |
| `epay-api` | `api:4000/metrics` | HTTP, payment, DB, and AI metrics |
| `epay-indexer` | `indexer:4100/metrics` | ledger lag and event-handler counters |
| `bullmq-exporter` | `:9538` | queue depth, active/delayed/failed jobs |
| `postgres-exporter` | `:9187` | transactions, connections, slow queries |
| `prometheus` | `localhost:9090` | self-monitoring |
| `pushgateway` | `:9091` | backup/restore-drill heartbeat gauges |

### `/metrics` authentication

`/metrics` is **bearer-token gated in production** (`METRICS_TOKEN`). Prometheus
reads the token from `monitoring/secrets/metrics_token`, which is mounted
read-only. In `NODE_ENV=development` the endpoint is open so local scrapes work
without configuration. Never commit the secrets directory — it is gitignored.

## Dashboards

Auto-provisioned from `grafana/dashboards/` into the **EPay** folder:

| Dashboard | Answers |
| --- | --- |
| `epay-platform-health` | Are the services up, fast, and not saturated? |
| `epay-payment-flow` | What fraction of payments succeed, and where do they stall? |
| `epay-queue-lag` | Is the indexer/webhook backlog growing? |
| `epay-ai-cost` | What are AI summaries costing, and is the cache working? |

Each file is a plain Grafana dashboard JSON and can also be imported manually via
*Dashboards → New → Import*.

## Alerts

`prometheus/rules/epay.yml` defines the rules; `alertmanager/alertmanager.yml`
routes them.

| Alert | Threshold | Severity |
| --- | --- | --- |
| `EpayApiHigh5xxRate` | 5xx > 2% for 5m | critical |
| `EpayApiP99LatencyHigh` | p99 > 2s for 10m | warning |
| `EpayReadinessProbeFailing` | unavailable replicas > 0 for 5m | critical |
| `EpayDbPoolWaitHigh` | pool wait p99 > 500ms for 10m | critical |
| `EpaySlowQueryP99High` | query p99 > 1s for 10m | warning |
| `EpayQueueLagHigh` | waiting jobs > 1000 for 10m | warning |
| `EpayBackupMissed` | no successful backup in 36h | critical |
| `EpayRestoreDrillFailed` | last drill did not succeed | critical |
| `EpayAiSpendAnomaly` | > $5/hr AI input spend | warning |

Routing: `critical` → PagerDuty **and** Slack, `warning` → Slack only. A critical
alert inhibits warnings for the same component, and a `business-hours` time
interval (weekdays 09:00–19:00 UTC) is defined for suppressing non-urgent warning
repeats outside working hours.

### Required secrets

| File | Consumed by |
| --- | --- |
| `monitoring/secrets/metrics_token` | Prometheus scrape auth |
| `monitoring/secrets/slack_webhook_url` | Alertmanager Slack receiver |
| `monitoring/secrets/pagerduty_routing_key` | Alertmanager PagerDuty receiver |

## Kubernetes

In Kubernetes the same config is deployed by the Helm chart
(`helm/epay/templates/monitoring.yaml`, toggled with `monitoring.enabled`), with
secrets sourced from `epay-monitoring-secrets` rather than the local `secrets/`
directory.
