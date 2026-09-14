import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_SCHEDULE_SECONDS,
  verifyWebhookSignature,
} from '@epay/shared/webhook-signature';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';
import { PrismaService } from '../database/prisma.service';

import { WebhookDispatcherService } from './webhook-dispatcher.service';

const MERCHANT_ID = 'merch_1';
const SECRET = 'whsec_test_secret';

/**
 * A delivery row as Prisma would return it. `payload` is a plain object because
 * that is what the `Json` column round-trips.
 */
function deliveryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'del_1',
    merchantId: MERCHANT_ID,
    eventType: 'payment.completed',
    url: 'https://receiver.test/epay',
    payload: { paymentId: 'pay_1', status: 'COMPLETED' },
    eventId: 'evt_1',
    signature: null,
    statusCode: null,
    response: null,
    attempts: 0,
    maxAttempts: WEBHOOK_MAX_ATTEMPTS,
    lastAttemptAt: null,
    nextAttemptAt: mockDate(),
    succeededAt: null,
    failedAt: null,
    deadLetteredAt: null,
    createdAt: mockDate(),
    ...overrides,
  };
}

describe('WebhookDispatcherService', () => {
  let service: WebhookDispatcherService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    // The dispatcher resolves the signing secret per merchant.
    prisma.merchant.findUnique.mockResolvedValue({ webhookSecret: SECRET });

    fetchMock = jest.fn();
    global.fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookDispatcherService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<WebhookDispatcherService>(WebhookDispatcherService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueue', () => {
    it('signs the payload and stores a delivery row', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(null);
      prisma.webhookDelivery.create.mockImplementation((args: { data: unknown }) =>
        Promise.resolve({ id: 'del_new', ...(args.data as Record<string, unknown>) }),
      );

      const result = await service.enqueue({
        merchantId: MERCHANT_ID,
        eventType: 'payment.completed',
        url: 'https://receiver.test/epay',
        eventId: 'evt_1',
        payload: { paymentId: 'pay_1' },
      });

      expect(result.id).toBe('del_new');

      // The stored signature must verify against the exact body we will send.
      const body = JSON.stringify({ paymentId: 'pay_1' });
      expect(verifyWebhookSignature({ secret: SECRET, header: result.signature, body })).toBe(true);
    });

    it('returns the existing delivery for a duplicate event id', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(
        deliveryRow({ id: 'del_existing', signature: 't=1,v1=abc' }),
      );

      const result = await service.enqueue({
        merchantId: MERCHANT_ID,
        eventType: 'payment.completed',
        url: 'https://receiver.test/epay',
        eventId: 'evt_1',
        payload: { paymentId: 'pay_1' },
      });

      expect(result.id).toBe('del_existing');
      // Replaying an event must not fan out a second webhook.
      expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
    });
  });

  describe('attempt', () => {
    it('marks the delivery succeeded on a 2xx response', async () => {
      prisma.webhookDelivery.findUnique.mockResolvedValue(deliveryRow());
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('ok') });

      const result = await service.attempt('del_1');

      expect(result.succeeded).toBe(true);
      expect(result.deadLettered).toBe(false);
      expect(result.nextAttemptAt).toBeNull();

      const update = prisma.webhookDelivery.update.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(update.data).toMatchObject({ attempts: 1, statusCode: 200, nextAttemptAt: null });
      expect(update.data.succeededAt).toBeInstanceOf(Date);
    });

    it('sends the documented signature and event headers', async () => {
      prisma.webhookDelivery.findUnique.mockResolvedValue(deliveryRow());
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });

      await service.attempt('del_1');

      const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
      expect(init.headers['X-EPay-Event-Id']).toBe('evt_1');
      expect(init.headers['X-EPay-Event-Type']).toBe('payment.completed');
      expect(init.headers['X-EPay-Signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);

      const body = JSON.stringify({ paymentId: 'pay_1', status: 'COMPLETED' });
      expect(
        verifyWebhookSignature({
          secret: SECRET,
          header: init.headers['X-EPay-Signature'],
          body,
        }),
      ).toBe(true);
    });

    it('schedules the first retry when the receiver returns 500', async () => {
      prisma.webhookDelivery.findUnique.mockResolvedValue(deliveryRow());
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
      });

      const before = Date.now();
      const result = await service.attempt('del_1');

      expect(result.succeeded).toBe(false);
      expect(result.deadLettered).toBe(false);

      const firstStep = WEBHOOK_RETRY_SCHEDULE_SECONDS[0] ?? 30;
      const delayMs = result.nextAttemptAt!.getTime() - before;
      // Allow a couple of seconds of slack for the test's own runtime.
      expect(delayMs).toBeGreaterThanOrEqual((firstStep - 2) * 1000);
      expect(delayMs).toBeLessThanOrEqual((firstStep + 2) * 1000);
    });

    it('retries when the receiver is unreachable', async () => {
      prisma.webhookDelivery.findUnique.mockResolvedValue(deliveryRow());
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.attempt('del_1');

      expect(result.succeeded).toBe(false);
      expect(result.deadLettered).toBe(false);
      expect(result.statusCode).toBeNull();

      const update = prisma.webhookDelivery.update.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(update.data.response).toContain('ECONNREFUSED');
    });

    it('dead-letters once the retry schedule is exhausted', async () => {
      // `attempts` counts attempts already made; the schedule has
      // WEBHOOK_MAX_ATTEMPTS - 1 retries, so being on the last one exhausts it.
      prisma.webhookDelivery.findUnique.mockResolvedValue(
        deliveryRow({ attempts: WEBHOOK_MAX_ATTEMPTS - 1 }),
      );
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('unavailable'),
      });

      const result = await service.attempt('del_1');

      expect(result.succeeded).toBe(false);
      expect(result.deadLettered).toBe(true);
      expect(result.nextAttemptAt).toBeNull();

      const update = prisma.webhookDelivery.update.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(update.data.deadLetteredAt).toBeInstanceOf(Date);
      expect(update.data.nextAttemptAt).toBeNull();
    });

    it('throws for an unknown delivery', async () => {
      prisma.webhookDelivery.findUnique.mockResolvedValue(null);

      await expect(service.attempt('missing')).rejects.toThrow('not found');
    });
  });

  describe('processDue', () => {
    it('claims each due delivery before attempting it', async () => {
      prisma.webhookDelivery.findMany.mockResolvedValue([deliveryRow()]);
      prisma.webhookDelivery.updateMany.mockResolvedValue({ count: 1 });
      prisma.webhookDelivery.findUnique.mockResolvedValue(deliveryRow());
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });

      const results = await service.processDue();

      expect(results).toHaveLength(1);
      expect(prisma.webhookDelivery.updateMany).toHaveBeenCalledTimes(1);
      // The claim must be conditional on the row still being due and unfinished,
      // otherwise two replicas both win the race.
      const claim = prisma.webhookDelivery.updateMany.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
      };
      expect(claim.where).toMatchObject({ id: 'del_1', succeededAt: null, deadLetteredAt: null });
      expect(claim.where.nextAttemptAt).toEqual({ lte: expect.any(Date) as Date });
    });

    it('skips a delivery another replica already claimed', async () => {
      prisma.webhookDelivery.findMany.mockResolvedValue([deliveryRow()]);
      // Another worker won the atomic update, so ours matched zero rows.
      prisma.webhookDelivery.updateMany.mockResolvedValue({ count: 0 });

      const results = await service.processDue();

      expect(results).toHaveLength(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns nothing when no delivery is due', async () => {
      prisma.webhookDelivery.findMany.mockResolvedValue([]);

      await expect(service.processDue()).resolves.toEqual([]);
      expect(prisma.webhookDelivery.updateMany).not.toHaveBeenCalled();
    });

    it('continues to later deliveries after one fails', async () => {
      prisma.webhookDelivery.findMany.mockResolvedValue([
        deliveryRow({ id: 'del_1', eventId: 'evt_1' }),
        deliveryRow({ id: 'del_2', eventId: 'evt_2' }),
      ]);
      prisma.webhookDelivery.updateMany.mockResolvedValue({ count: 1 });
      prisma.webhookDelivery.findUnique.mockImplementation((args: { where: { id: string } }) =>
        Promise.resolve(deliveryRow({ id: args.where.id })),
      );
      fetchMock
        .mockRejectedValueOnce(new Error('receiver down'))
        .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('') });

      const results = await service.processDue();

      expect(results).toHaveLength(2);
      expect(results.filter((r) => r.succeeded)).toHaveLength(1);
    });
  });
});
