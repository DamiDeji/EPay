import { Injectable } from '@nestjs/common';

import { Counter, Gauge, Histogram, MetricsRegistry, type MetricLabels } from './metrics.registry';

/**
 * The API's metric surface.
 *
 * Metric names are not arbitrary: `monitoring/prometheus/rules/epay.yml` and the
 * Grafana dashboards reference these exact names, so renaming one silently
 * disables an alert. Change the rule and this file together.
 */
@Injectable()
export class MetricsService {
  private readonly registry = new MetricsRegistry();

  /** `epay_http_requests_total{method,route,status}` — feeds the 5xx-rate alert. */
  private readonly httpRequestsTotal = this.registry.register(
    new Counter('epay_http_requests_total', 'Total HTTP requests handled by the EPay API.'),
  );

  /** `epay_http_request_duration_seconds{method,route}` — p50/p95/p99 latency. */
  private readonly httpRequestDuration = this.registry.register(
    new Histogram('epay_http_request_duration_seconds', 'HTTP request latency in seconds.'),
  );

  /** `epay_db_pool_wait_seconds` — time spent waiting for a Prisma connection. */
  private readonly dbPoolWait = this.registry.register(
    new Histogram(
      'epay_db_pool_wait_seconds',
      'Time waiting to acquire a database connection.',
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    ),
  );

  /** `epay_db_query_duration_seconds{query}` — per-query latency. */
  private readonly dbQueryDuration = this.registry.register(
    new Histogram('epay_db_query_duration_seconds', 'Database query duration in seconds.'),
  );

  /** `epay_queue_waiting_jobs{queue}` — BullMQ backlog; feeds the queue-lag alert. */
  private readonly queueWaitingJobs = this.registry.register(
    new Gauge('epay_queue_waiting_jobs', 'Number of BullMQ jobs currently waiting.'),
  );

  /** `epay_ai_tokens_total{direction}` — feeds the AI spend-anomaly alert. */
  private readonly aiTokensTotal = this.registry.register(
    new Counter('epay_ai_tokens_total', 'AI summary tokens consumed, by direction.'),
  );

  /** `epay_process_uptime_seconds` — liveness proxy for dashboards. */
  private readonly processUptime = this.registry.register(
    new Gauge('epay_process_uptime_seconds', 'Process uptime in seconds.'),
  );

  /** `epay_webhook_deliveries_total{outcome}` — feeds the webhook-failure alert. */
  private readonly webhookDeliveriesTotal = this.registry.register(
    new Counter('epay_webhook_deliveries_total', 'Webhook delivery attempts, by outcome.'),
  );

  /** `epay_webhook_dispatch_errors_total` — dispatch passes that blew up entirely. */
  private readonly webhookDispatchErrors = this.registry.register(
    new Counter('epay_webhook_dispatch_errors_total', 'Webhook dispatch passes that failed.'),
  );

  private readonly buildInfo = this.registry.register(
    new Gauge('epay_build_info', 'Build information; always 1.'),
  );

  constructor() {
    this.buildInfo.set(
      {
        version: process.env.npm_package_version ?? '0.0.0',
        node: process.version,
        env: process.env.NODE_ENV ?? 'development',
      },
      1,
    );
  }

  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    const labels: MetricLabels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe({ method, route }, durationSeconds);
  }

  recordDbPoolWait(seconds: number): void {
    this.dbPoolWait.observe({}, seconds);
  }

  recordDbQuery(query: string, seconds: number): void {
    this.dbQueryDuration.observe({ query }, seconds);
  }

  setQueueWaiting(queue: string, waiting: number): void {
    this.queueWaitingJobs.set({ queue }, waiting);
  }

  recordAiTokens(direction: 'input' | 'output', tokens: number): void {
    this.aiTokensTotal.inc({ direction }, tokens);
  }

  /**
   * One dispatch pass's worth of delivery outcomes.
   *
   * `dead_lettered` is the one worth alerting on: it means a receiver has been
   * unreachable for the whole ~8.5h retry schedule.
   */
  recordWebhookDeliveries(outcomes: {
    succeeded: number;
    retrying: number;
    deadLettered: number;
  }): void {
    if (outcomes.succeeded > 0) {
      this.webhookDeliveriesTotal.inc({ outcome: 'succeeded' }, outcomes.succeeded);
    }
    if (outcomes.retrying > 0) {
      this.webhookDeliveriesTotal.inc({ outcome: 'retrying' }, outcomes.retrying);
    }
    if (outcomes.deadLettered > 0) {
      this.webhookDeliveriesTotal.inc({ outcome: 'dead_lettered' }, outcomes.deadLettered);
    }
  }

  recordWebhookDispatchError(): void {
    this.webhookDispatchErrors.inc();
  }

  /** Refresh gauges that are computed at scrape time. */
  collect(): void {
    this.processUptime.set({}, process.uptime());
  }

  /** Prometheus text exposition format (version 0.0.4). */
  expose(): string {
    this.collect();
    return this.registry.expose();
  }
}
