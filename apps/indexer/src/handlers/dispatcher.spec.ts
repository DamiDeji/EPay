import { beforeEach, describe, expect, it } from 'vitest';

import { decodeFailures, eventsProcessed } from '../metrics';
import { fakePrisma, parsedEvent } from '../testing/doubles';

import { dispatchEvent } from './dispatcher';

beforeEach(() => {
  eventsProcessed.reset();
  decodeFailures.reset();
});

describe('dispatchEvent', () => {
  it('records a decoded event durably', async () => {
    const prisma = fakePrisma();

    await expect(dispatchEvent(parsedEvent(), prisma.client)).resolves.toBe('recorded');

    expect(prisma.events).toHaveLength(1);
    expect(prisma.events[0]).toMatchObject({
      eventId: '0000123456-0000000001',
      contractName: 'PaymentRouter',
      eventName: 'payment_created',
      ledgerSequence: 100,
      txHash: 'f'.repeat(64),
      payload: { paymentId: '1' },
    });
    // The event is applied on write, because recording *is* the projection today.
    expect(prisma.events[0]?.appliedAt).toBeInstanceOf(Date);
  });

  it('converts the ledger close time to a Date', async () => {
    const prisma = fakePrisma();

    await dispatchEvent(parsedEvent({ timestamp: 1_700_000_000 }), prisma.client);

    expect(prisma.events[0]?.occurredAt.getTime()).toBe(1_700_000_000_000);
  });

  it('is idempotent: the same event id never produces a second row', async () => {
    const prisma = fakePrisma();
    const event = parsedEvent();

    await expect(dispatchEvent(event, prisma.client)).resolves.toBe('recorded');
    await expect(dispatchEvent(event, prisma.client)).resolves.toBe('duplicate');
    await expect(dispatchEvent(event, prisma.client)).resolves.toBe('duplicate');

    expect(prisma.events).toHaveLength(1);
  });

  it('treats a retried delivery as a duplicate, not an error', async () => {
    const prisma = fakePrisma();
    const event = parsedEvent();

    await dispatchEvent(event, prisma.client);
    await dispatchEvent(event, prisma.client);

    expect(
      eventsProcessed.get({
        contract: 'PaymentRouter',
        event: 'payment_created',
        known: 'true',
        outcome: 'recorded',
      }),
    ).toBe(1);
    expect(
      eventsProcessed.get({
        contract: 'PaymentRouter',
        event: 'payment_created',
        known: 'true',
        outcome: 'duplicate',
      }),
    ).toBe(1);
  });

  it('records distinct events from the same transaction', async () => {
    const prisma = fakePrisma();

    await dispatchEvent(
      parsedEvent({ eventId: 'tx-1-1', eventName: 'payment_completed' }),
      prisma.client,
    );
    await dispatchEvent(
      parsedEvent({ eventId: 'tx-1-2', eventName: 'fee_collected' }),
      prisma.client,
    );

    expect(prisma.events).toHaveLength(2);
  });

  it('rethrows a non-unique database failure so the batch is retried', async () => {
    const prisma = fakePrisma();
    prisma.failNextCreate(new Error('connection reset'));

    await expect(dispatchEvent(parsedEvent(), prisma.client)).rejects.toThrow('connection reset');
    expect(prisma.events).toHaveLength(0);
    expect(
      eventsProcessed.get({
        contract: 'PaymentRouter',
        event: 'payment_created',
        known: 'true',
        outcome: 'failed',
      }),
    ).toBe(1);
  });

  it('records unknown events so a contract upgrade is visible', async () => {
    const prisma = fakePrisma();

    await dispatchEvent(
      parsedEvent({
        eventName: 'brand_new_event',
        known: false,
        fieldNames: ['arg0'],
        data: { arg0: '1' },
      }),
      prisma.client,
    );

    expect(prisma.events[0]?.eventName).toBe('brand_new_event');
    expect(
      eventsProcessed.get({
        contract: 'PaymentRouter',
        event: 'brand_new_event',
        known: 'false',
        outcome: 'recorded',
      }),
    ).toBe(1);
  });
});
