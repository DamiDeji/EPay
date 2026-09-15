import { Counter, Gauge, Histogram, MetricsRegistry } from '@epay/shared';

/**
 * Prometheus metrics for the indexer.
 *
 * The names here are a contract with the deployed monitoring stack:
 * `epay_indexer_ledger_lag` is what `monitoring/grafana/dashboards/epay-queue-lag.json`
 * plots, and `monitoring/prometheus/prometheus.yml` scrapes this endpoint on
 * port 4100. Renaming a metric silently empties a dashboard panel.
 */
export const registry = new MetricsRegistry();

/** Ledgers between the chain tip and the last fully processed ledger. */
export const ledgerLag = registry.register(
  new Gauge(
    'epay_indexer_ledger_lag',
    'Ledgers between the Stellar chain tip and the last ledger processed by the indexer.',
  ),
);

/** Latest chain tip observed, so lag can be recomputed if the tip moves. */
export const chainTipLedger = registry.register(
  new Gauge(
    'epay_indexer_chain_tip_ledger',
    'Latest Stellar ledger sequence reported by Soroban RPC.',
  ),
);

/** Highest ledger whose events have been durably committed. */
export const lastProcessedLedger = registry.register(
  new Gauge(
    'epay_indexer_last_processed_ledger',
    'Highest ledger whose events have been projected and checkpointed.',
  ),
);

/** Decoded events by contract, event name and outcome. */
export const eventsProcessed = registry.register(
  new Counter(
    'epay_indexer_events_total',
    'Soroban contract events handled by the indexer, by contract, event and outcome.',
  ),
);

/** Events that arrived on a watched contract but could not be decoded. */
export const decodeFailures = registry.register(
  new Counter(
    'epay_indexer_decode_failures_total',
    'Soroban contract events that could not be decoded into a structured event.',
  ),
);

/** Soroban RPC calls, by method and outcome. */
export const rpcRequests = registry.register(
  new Counter(
    'epay_indexer_rpc_requests_total',
    'Soroban RPC requests issued by the indexer, by method and outcome.',
  ),
);

/** Wall-clock time to read a ledger range from Soroban RPC. */
export const scanDuration = registry.register(
  new Histogram(
    'epay_indexer_scan_duration_seconds',
    'Time taken to fetch and decode one ledger range from Soroban RPC.',
  ),
);

/** Wall-clock time to process one sync batch end to end. */
export const batchDuration = registry.register(
  new Histogram(
    'epay_indexer_batch_duration_seconds',
    'Time taken to process one indexer batch (scan + decode + checkpoint).',
  ),
);

/** Process uptime, so a restart is visible on a graph. */
export const uptime = registry.register(
  new Gauge('epay_indexer_uptime_seconds', 'Seconds since the indexer process started.'),
);

const startedAt = Date.now();

/** Refresh the gauge metrics that are read at scrape time. */
export function collectRuntimeMetrics(): void {
  uptime.set({}, Math.round((Date.now() - startedAt) / 1000));
}
