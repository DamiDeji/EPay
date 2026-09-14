import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { MetricsService } from '../observability/metrics.service';

import { WebhookDispatcherService } from './webhook-dispatcher.service';

/**
 * How often to look for deliveries that have come due. The shortest backoff step
 * is 30s, so a 15s tick keeps the schedule accurate without busy-waiting.
 */
const TICK_INTERVAL_MS = 15_000;

/** Deliveries to attempt per tick. Bounded so one tick cannot run unboundedly. */
const BATCH_SIZE = 50;

/**
 * Drives {@link WebhookDispatcherService.processDue} on a timer.
 *
 * Signing, retry scheduling, dead-lettering and per-event idempotency all lived
 * in the dispatcher, but nothing ever called `processDue()` — so no webhook was
 * ever actually delivered, no matter how many `WebhookDelivery` rows piled up.
 * This is the missing entry point.
 *
 * Deliberately a plain interval rather than a BullMQ repeatable job: the API
 * already configures a Redis connection it never uses, and requiring Redis just
 * to tick a timer would make a broker outage silently stop webhooks. Safety
 * across replicas is handled where it actually matters — the dispatcher's atomic
 * per-row claim — so running this on every replica is fine.
 *
 * Set `WEBHOOK_DISPATCH_ENABLED=false` to disable (used by tests and by
 * deployments where a separate worker owns outbound delivery).
 */
@Injectable()
export class WebhookDispatchScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDispatchScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  /** Guards against a slow batch overlapping the next tick. */
  private running = false;

  constructor(
    private readonly dispatcher: WebhookDispatcherService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    if (process.env.WEBHOOK_DISPATCH_ENABLED === 'false') {
      this.logger.log('Webhook dispatch scheduler disabled (WEBHOOK_DISPATCH_ENABLED=false)');
      return;
    }

    // Run once at boot so a restart immediately drains a backlog instead of
    // waiting a full interval.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    // Do not hold the event loop open just for the webhook timer.
    this.timer.unref?.();

    this.logger.log(`Webhook dispatch scheduler started (every ${String(TICK_INTERVAL_MS)}ms)`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * One dispatch pass. Never throws — an unhandled rejection from a timer
   * callback would take the process down.
   */
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.debug('Previous webhook dispatch pass still running; skipping tick');
      return;
    }
    this.running = true;

    try {
      const results = await this.dispatcher.processDue(BATCH_SIZE);
      if (results.length === 0) {
        return;
      }

      const succeeded = results.filter((r) => r.succeeded).length;
      const deadLettered = results.filter((r) => r.deadLettered).length;
      const retrying = results.length - succeeded - deadLettered;

      this.metrics.recordWebhookDeliveries({ succeeded, retrying, deadLettered });

      if (deadLettered > 0) {
        this.logger.error(
          `${String(deadLettered)} webhook delivery(ies) dead-lettered after exhausting the retry schedule`,
        );
      }
      this.logger.debug(
        `Webhook dispatch: ${String(succeeded)} sent, ${String(retrying)} retrying, ${String(deadLettered)} dead-lettered`,
      );
    } catch (error) {
      this.metrics.recordWebhookDispatchError();
      this.logger.error(
        `Webhook dispatch pass failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
