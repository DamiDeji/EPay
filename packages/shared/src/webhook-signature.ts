/**
 * Outbound webhook signing and retry policy.
 *
 * Kept in `@epay/shared` so the sender (API), any future sender (indexer), and
 * the documented receiver recipe all use the same implementation. It is a
 * separate entry point (`@epay/shared/webhook-signature`) rather than a re-export
 * from the package root because it uses `node:crypto` and must never be pulled
 * into a browser bundle.
 *
 * The header format is GitHub's, for the same reason GitHub uses it:
 *
 *   X-EPay-Signature: t=1694649600,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
 *
 * `t` is the Unix timestamp (seconds) at signing time and `v1` is
 * `HMAC-SHA256(secret, "${t}.${rawBody}")`. The timestamp is included in the
 * signed input, so an attacker cannot change it, and the receiver can reject
 * anything outside the tolerance window to blunt replay attacks. Multiple `v1`
 * values are allowed in the header so a secret can be rotated without downtime.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_SIGNATURE_VERSION = 'v1';

/** Reject signatures whose timestamp is more than five minutes from now. */
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Backoff schedule between delivery attempts: 30s, 2m, 10m, 30m, 2h, 6h.
 * After the final entry the delivery is dead-lettered. Six retries over ~8.5
 * hours absorbs a receiver's deploy window without hammering it during an
 * outage.
 */
export const WEBHOOK_RETRY_SCHEDULE_SECONDS: readonly number[] = [30, 120, 600, 1800, 7200, 21600];

/** Total number of attempts (initial + retries) before dead-lettering. */
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_SCHEDULE_SECONDS.length + 1;

export interface ParsedWebhookSignature {
  timestamp: number;
  signatures: string[];
}

/**
 * Compute the `v1` signature over `"${timestamp}.${body}"`.
 *
 * `body` must be the *exact* bytes that are sent — sign the serialised string and
 * send that same string, never re-serialise.
 */
export function computeWebhookSignature(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Build the full `X-EPay-Signature` header value. */
export function buildWebhookSignatureHeader(
  secret: string,
  body: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const signature = computeWebhookSignature(secret, timestamp, body);
  return `t=${timestamp},${WEBHOOK_SIGNATURE_VERSION}=${signature}`;
}

/** Parse a signature header, returning `null` if it is malformed. */
export function parseWebhookSignatureHeader(header: string): ParsedWebhookSignature | null {
  let timestamp: number | undefined;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const [rawKey, rawValue] = part.split('=', 2);
    const key = rawKey?.trim();
    const value = rawValue?.trim();
    if (!key || !value) {
      continue;
    }
    if (key === 't') {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) {
        return null;
      }
      timestamp = parsed;
    } else if (key === WEBHOOK_SIGNATURE_VERSION) {
      signatures.push(value.toLowerCase());
    }
  }

  if (timestamp === undefined || signatures.length === 0) {
    return null;
  }
  return { timestamp, signatures };
}

/**
 * True when `timestamp` is within the tolerance window of `nowSeconds`.
 *
 * Both directions are checked: a far-future timestamp is as suspicious as a
 * stale one (a clock-skewed or forged replay).
 */
export function isWebhookTimestampFresh(
  timestamp: number,
  toleranceSeconds: number = WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  return Math.abs(nowSeconds - timestamp) <= toleranceSeconds;
}

export interface VerifyWebhookSignatureParams {
  secret: string;
  header: string;
  body: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}

/**
 * Constant-time verification of a webhook signature.
 *
 * Returns `false` (never throws) for a malformed header, a stale timestamp, or a
 * mismatch, so a receiver can safely `if (!verify) return 401`.
 */
export function verifyWebhookSignature(params: VerifyWebhookSignatureParams): boolean {
  const parsed = parseWebhookSignatureHeader(params.header);
  if (!parsed) {
    return false;
  }

  const tolerance = params.toleranceSeconds ?? WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS;
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!isWebhookTimestampFresh(parsed.timestamp, tolerance, now)) {
    return false;
  }

  const expected = computeWebhookSignature(params.secret, parsed.timestamp, params.body);
  return parsed.signatures.some((candidate) => safeEqualHex(candidate, expected));
}

/**
 * Delay before retrying after `attemptIndex` failures (0-based), or `null` when
 * the schedule is exhausted and the delivery should be dead-lettered.
 */
export function nextWebhookRetryDelaySeconds(attemptIndex: number): number | null {
  if (attemptIndex < 0) {
    return WEBHOOK_RETRY_SCHEDULE_SECONDS[0] ?? null;
  }
  if (attemptIndex >= WEBHOOK_RETRY_SCHEDULE_SECONDS.length) {
    return null;
  }
  return WEBHOOK_RETRY_SCHEDULE_SECONDS[attemptIndex] ?? null;
}

/**
 * Stable idempotency key for a webhook event. Receivers key their dedupe store on
 * this, and the sender refuses to create a second delivery row for the same key
 * within the replay window.
 */
export function webhookIdempotencyKey(merchantId: string, eventId: string): string {
  return `${merchantId}:${eventId}`;
}

function safeEqualHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
