import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_SCHEDULE_SECONDS,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  buildWebhookSignatureHeader,
  computeWebhookSignature,
  isWebhookTimestampFresh,
  nextWebhookRetryDelaySeconds,
  parseWebhookSignatureHeader,
  verifyWebhookSignature,
  webhookIdempotencyKey,
} from './webhook-signature';

const SECRET = 'whsec_test_2f5a1c';
const BODY = JSON.stringify({ id: 'evt_1', type: 'payment.completed', amount: '1000000' });
const NOW = 1_700_000_000;

describe('computeWebhookSignature', () => {
  it('matches a hand-computed HMAC over "${t}.${body}"', () => {
    const expected = createHmac('sha256', SECRET).update(`${NOW}.${BODY}`).digest('hex');
    expect(computeWebhookSignature(SECRET, NOW, BODY)).toBe(expected);
  });

  it('changes when the timestamp changes, so `t` cannot be tampered with', () => {
    expect(computeWebhookSignature(SECRET, NOW, BODY)).not.toBe(
      computeWebhookSignature(SECRET, NOW + 1, BODY),
    );
  });

  it('changes when the body changes', () => {
    expect(computeWebhookSignature(SECRET, NOW, BODY)).not.toBe(
      computeWebhookSignature(SECRET, NOW, `${BODY} `),
    );
  });
});

describe('buildWebhookSignatureHeader', () => {
  it('emits GitHub-style t=...,v1=...', () => {
    const header = buildWebhookSignatureHeader(SECRET, BODY, NOW);
    expect(header).toBe(`t=${NOW},v1=${computeWebhookSignature(SECRET, NOW, BODY)}`);
  });
});

describe('parseWebhookSignatureHeader', () => {
  it('parses a timestamp and one signature', () => {
    expect(parseWebhookSignatureHeader('t=1700000000,v1=abcdef')).toEqual({
      timestamp: 1700000000,
      signatures: ['abcdef'],
    });
  });

  it('collects multiple v1 signatures for rotation', () => {
    const parsed = parseWebhookSignatureHeader('t=1700000000,v1=aaa,v1=BBB');
    expect(parsed?.signatures).toEqual(['aaa', 'bbb']);
  });

  it('returns null for a malformed header', () => {
    expect(parseWebhookSignatureHeader('')).toBeNull();
    expect(parseWebhookSignatureHeader('v1=abc')).toBeNull();
    expect(parseWebhookSignatureHeader('t=notanumber,v1=abc')).toBeNull();
    expect(parseWebhookSignatureHeader('t=1700000000')).toBeNull();
  });
});

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed, fresh payload', () => {
    const header = buildWebhookSignatureHeader(SECRET, BODY, NOW);
    expect(verifyWebhookSignature({ secret: SECRET, header, body: BODY, nowSeconds: NOW })).toBe(
      true,
    );
  });

  it('rejects a tampered body', () => {
    const header = buildWebhookSignatureHeader(SECRET, BODY, NOW);
    expect(
      verifyWebhookSignature({ secret: SECRET, header, body: `${BODY}x`, nowSeconds: NOW }),
    ).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const header = buildWebhookSignatureHeader('other-secret', BODY, NOW);
    expect(verifyWebhookSignature({ secret: SECRET, header, body: BODY, nowSeconds: NOW })).toBe(
      false,
    );
  });

  it('rejects a replay outside the tolerance window', () => {
    const header = buildWebhookSignatureHeader(SECRET, BODY, NOW);
    const tooLate = NOW + WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS + 1;
    expect(
      verifyWebhookSignature({ secret: SECRET, header, body: BODY, nowSeconds: tooLate }),
    ).toBe(false);
  });

  it('rejects a far-future timestamp', () => {
    const header = buildWebhookSignatureHeader(SECRET, BODY, NOW + 10_000);
    expect(verifyWebhookSignature({ secret: SECRET, header, body: BODY, nowSeconds: NOW })).toBe(
      false,
    );
  });

  it('accepts any matching signature when several are present (rotation)', () => {
    const good = computeWebhookSignature(SECRET, NOW, BODY);
    const header = `t=${NOW},v1=deadbeef,v1=${good}`;
    expect(verifyWebhookSignature({ secret: SECRET, header, body: BODY, nowSeconds: NOW })).toBe(
      true,
    );
  });
});

describe('isWebhookTimestampFresh', () => {
  it('tolerates exactly the window and rejects just outside it', () => {
    expect(isWebhookTimestampFresh(NOW, 300, NOW + 300)).toBe(true);
    expect(isWebhookTimestampFresh(NOW, 300, NOW + 301)).toBe(false);
    expect(isWebhookTimestampFresh(NOW, 300, NOW - 301)).toBe(false);
  });
});

describe('nextWebhookRetryDelaySeconds', () => {
  it('follows the documented 30s, 2m, 10m, 30m, 2h, 6h schedule', () => {
    expect(WEBHOOK_RETRY_SCHEDULE_SECONDS).toEqual([30, 120, 600, 1800, 7200, 21600]);
    expect(nextWebhookRetryDelaySeconds(0)).toBe(30);
    expect(nextWebhookRetryDelaySeconds(1)).toBe(120);
    expect(nextWebhookRetryDelaySeconds(2)).toBe(600);
    expect(nextWebhookRetryDelaySeconds(3)).toBe(1800);
    expect(nextWebhookRetryDelaySeconds(4)).toBe(7200);
    expect(nextWebhookRetryDelaySeconds(5)).toBe(21600);
  });

  it('returns null once the schedule is exhausted, signalling a dead letter', () => {
    expect(nextWebhookRetryDelaySeconds(6)).toBeNull();
    expect(nextWebhookRetryDelaySeconds(99)).toBeNull();
    expect(WEBHOOK_MAX_ATTEMPTS).toBe(7);
  });
});

describe('webhookIdempotencyKey', () => {
  it('is scoped to the merchant and stable across retries', () => {
    expect(webhookIdempotencyKey('m_1', 'evt_9')).toBe('m_1:evt_9');
    expect(webhookIdempotencyKey('m_1', 'evt_9')).toBe(webhookIdempotencyKey('m_1', 'evt_9'));
  });
});
