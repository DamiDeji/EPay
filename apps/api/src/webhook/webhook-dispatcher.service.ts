import { createHash } from 'node:crypto';

import {
  buildWebhookSignatureHeader,
  nextWebhookRetryDelaySeconds,
  WEBHOOK_MAX_ATTEMPTS,
} from '@epay/shared/webhook-signature';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

/** Give up on a single HTTP attempt after this long. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Store at most this much of a receiver's response body. */
const MAX_RESPONSE_SNIPPET = 1024;

/**
 * How long a claimed delivery stays invisible to other workers.
 *
 * `processDue` claims a row by pushing `nextAttemptAt` forward by this much
 * inside a conditional `updateMany`. Run `N` API replicas and only the replica
 * whose update matched one row sends the request; the rest see zero rows and
 * move on. If the claiming replica dies mid-request the lease simply expires and
 * the delivery becomes due again, so a crash delays a webhook instead of losing
 * it. 60s comfortably exceeds `REQUEST_TIMEOUT_MS`.
 */
const CLAIM_LEASE_MS = 60_000;

export interface EnqueueWebhookParams {
  merchantId: string;
  eventType: string;
  url: string;
  /** Id of the originating event; the dedupe key within a merchant. */
  eventId: string;
  payload: Record<string, unknown>;
  /** Overrides the merchant's stored secret (used in tests and replays). */
  secret?: string;
}

export interface WebhookAttemptResult {
  deliveryId: string;
  statusCode: number | null;
  succeeded: boolean;
  /** Null when the delivery is now terminal (success, or dead-lettered). */
  nextAttemptAt: Date | null;
  deadLettered: boolean;
}

/**
 * Signs and delivers outbound webhooks.
 *
 * Contract with receivers (documented in `docs/webhook-receiver.md`):
 *  * every request carries `X-EPay-Signature: t=...,v1=...` and `X-EPay-Event-Id`,
 *  * a non-2xx response, or any network error, triggers the
 *    30s/2m/10m/30m/2h/6h backoff,
 *  * after the schedule is exhausted the delivery is dead-lettered (kept in the
 *    table with `deadLetteredAt` set) instead of being dropped silently,
 *  * `eventId` is stable across retries, so a receiver can dedupe safely.
 */
@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create the delivery row and sign it, but do not send. Idempotent per
   * `(merchantId, eventId)`: enqueuing the same event twice returns the existing
   * delivery rather than fanning out a duplicate webhook.
   */
  async enqueue(params: EnqueueWebhookParams): Promise<{ id: string; signature: string }> {
    const secret = params.secret ?? (await this.secretFor(params.merchantId));
    const body = JSON.stringify(params.payload);
    const signature = buildWebhookSignatureHeader(secret, body);

    const existing = await this.prisma.webhookDelivery.findFirst({
      where: { merchantId: params.merchantId, eventId: params.eventId },
    });
    if (existing) {
      return { id: existing.id, signature: existing.signature ?? signature };
    }

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        merchantId: params.merchantId,
        eventType: params.eventType,
        url: params.url,

        payload: params.payload as any,
        eventId: params.eventId,
        signature,
        maxAttempts: WEBHOOK_MAX_ATTEMPTS,
        nextAttemptAt: new Date(),
      },
    });

    return { id: delivery.id, signature };
  }

  /**
   * Attempt every delivery whose retry is due, claiming each one first so that
   * concurrent workers cannot send the same webhook twice.
   *
   * Returns only the results this caller actually processed — a delivery another
   * replica claimed is not reported here.
   */
  async processDue(limit = 50): Promise<WebhookAttemptResult[]> {
    const now = new Date();
    const due = await this.prisma.webhookDelivery.findMany({
      where: {
        succeededAt: null,
        deadLetteredAt: null,
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });

    const results: WebhookAttemptResult[] = [];
    for (const delivery of due) {
      if (!(await this.claim(delivery.id, now))) {
        continue;
      }
      results.push(await this.attempt(delivery.id));
    }
    return results;
  }

  /**
   * Take exclusive responsibility for a delivery by pushing its `nextAttemptAt`
   * into the future, but only if it is still due and still unfinished. The
   * `updateMany` + `count` check is the whole point: it is a single atomic
   * statement, so two replicas racing for the same row cannot both see `1`.
   */
  private async claim(id: string, now: Date): Promise<boolean> {
    const result = await this.prisma.webhookDelivery.updateMany({
      where: {
        id,
        succeededAt: null,
        deadLetteredAt: null,
        nextAttemptAt: { lte: now },
      },
      data: { nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS) },
    });
    return result.count === 1;
  }

  /** Perform a single delivery attempt and apply the retry policy. */
  async attempt(deliveryId: string): Promise<WebhookAttemptResult> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery) {
      throw new Error(`Webhook delivery ${deliveryId} not found`);
    }

    const body = JSON.stringify(delivery.payload);
    const signature =
      delivery.signature ??
      buildWebhookSignatureHeader(await this.secretFor(delivery.merchantId), body);

    let statusCode: number | null = null;
    // Assigned on every path below — in the `try` from the receiver's body, or
    // in the `catch` from the failure itself — so an initial value would only
    // ever be overwritten.
    let responseSnippet: string;
    let succeeded = false;

    try {
      const response = await fetch(delivery.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-EPay-Signature': signature,
          'X-EPay-Event-Id': delivery.eventId ?? delivery.id,
          'X-EPay-Event-Type': delivery.eventType,
          'User-Agent': 'EPay-Webhooks/1.0',
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      statusCode = response.status;
      succeeded = response.ok;
      responseSnippet = (await response.text()).slice(0, MAX_RESPONSE_SNIPPET);
    } catch (error) {
      responseSnippet = error instanceof Error ? error.message : String(error);
    }

    return this.recordAttempt(
      delivery.id,
      delivery.attempts,
      statusCode,
      responseSnippet,
      succeeded,
    );
  }

  private async recordAttempt(
    id: string,
    previousAttempts: number,
    statusCode: number | null,
    responseSnippet: string,
    succeeded: boolean,
  ): Promise<WebhookAttemptResult> {
    const attempts = previousAttempts + 1;
    const now = new Date();

    if (succeeded) {
      await this.prisma.webhookDelivery.update({
        where: { id },
        data: {
          attempts,
          statusCode,
          response: responseSnippet,
          lastAttemptAt: now,
          succeededAt: now,
          nextAttemptAt: null,
        },
      });
      return {
        deliveryId: id,
        statusCode,
        succeeded: true,
        nextAttemptAt: null,
        deadLettered: false,
      };
    }

    // `attemptIndex` is the number of *retries* already scheduled.
    const delaySeconds = nextWebhookRetryDelaySeconds(attempts - 1);

    if (delaySeconds === null) {
      await this.prisma.webhookDelivery.update({
        where: { id },
        data: {
          attempts,
          statusCode,
          response: responseSnippet,
          lastAttemptAt: now,
          failedAt: now,
          deadLetteredAt: now,
          nextAttemptAt: null,
        },
      });
      this.logger.error(
        `Webhook delivery ${id} dead-lettered after ${String(attempts)} attempts (last status ${String(statusCode)})`,
      );
      return {
        deliveryId: id,
        statusCode,
        succeeded: false,
        nextAttemptAt: null,
        deadLettered: true,
      };
    }

    const nextAttemptAt = new Date(now.getTime() + delaySeconds * 1000);
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: {
        attempts,
        statusCode,
        response: responseSnippet,
        lastAttemptAt: now,
        nextAttemptAt,
      },
    });

    this.logger.warn(
      `Webhook delivery ${id} failed (status ${String(statusCode)}); retrying in ${String(delaySeconds)}s`,
    );
    return { deliveryId: id, statusCode, succeeded: false, nextAttemptAt, deadLettered: false };
  }

  /** The merchant's signing secret, or a deterministic fallback for merchants
   * who have not set one (so a delivery can still be verified during onboarding). */
  private async secretFor(merchantId: string): Promise<string> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { webhookSecret: true },
    });

    if (merchant?.webhookSecret) {
      return merchant.webhookSecret;
    }
    return createHash('sha256').update(`epay:${merchantId}`).digest('hex');
  }
}
