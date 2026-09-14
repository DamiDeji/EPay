import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { MetricsService } from '../observability/metrics.service';

import { WebhookDispatchScheduler } from './webhook-dispatch.scheduler';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import type { WebhookAttemptResult } from './webhook-dispatcher.service';

function attempt(overrides: Partial<WebhookAttemptResult> = {}): WebhookAttemptResult {
  return {
    deliveryId: 'del_1',
    statusCode: 200,
    succeeded: true,
    nextAttemptAt: null,
    deadLettered: false,
    ...overrides,
  };
}

describe('WebhookDispatchScheduler', () => {
  let scheduler: WebhookDispatchScheduler;
  let dispatcher: { processDue: jest.Mock };
  let metrics: MetricsService;
  let originalEnabled: string | undefined;

  beforeEach(async () => {
    originalEnabled = process.env.WEBHOOK_DISPATCH_ENABLED;
    delete process.env.WEBHOOK_DISPATCH_ENABLED;

    dispatcher = { processDue: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDispatchScheduler,
        { provide: WebhookDispatcherService, useValue: dispatcher },
        MetricsService,
      ],
    }).compile();

    scheduler = module.get<WebhookDispatchScheduler>(WebhookDispatchScheduler);
    metrics = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    scheduler.onModuleDestroy();
    jest.useRealTimers();
    if (originalEnabled === undefined) {
      delete process.env.WEBHOOK_DISPATCH_ENABLED;
    } else {
      process.env.WEBHOOK_DISPATCH_ENABLED = originalEnabled;
    }
  });

  it('starts a timer that drives processDue', async () => {
    jest.useFakeTimers();
    scheduler.onModuleInit();
    // The first pass runs immediately at boot.
    await Promise.resolve();
    expect(dispatcher.processDue).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(15_000);
    expect(dispatcher.processDue).toHaveBeenCalledTimes(2);
  });

  it('does not start when WEBHOOK_DISPATCH_ENABLED is false', () => {
    process.env.WEBHOOK_DISPATCH_ENABLED = 'false';
    jest.useFakeTimers();

    scheduler.onModuleInit();

    jest.advanceTimersByTime(60_000);
    expect(dispatcher.processDue).not.toHaveBeenCalled();
  });

  it('stops ticking after the module is destroyed', async () => {
    jest.useFakeTimers();
    scheduler.onModuleInit();
    await Promise.resolve();
    scheduler.onModuleDestroy();

    await jest.advanceTimersByTimeAsync(60_000);
    expect(dispatcher.processDue).toHaveBeenCalledTimes(1);
  });

  it('records one metric per outcome', async () => {
    dispatcher.processDue.mockResolvedValue([
      attempt(),
      attempt({ deliveryId: 'del_2', succeeded: false, statusCode: 500 }),
      attempt({ deliveryId: 'del_3', succeeded: false, deadLettered: true, statusCode: 503 }),
    ]);

    await scheduler.tick();

    const exposed = metrics.expose();
    expect(exposed).toContain('epay_webhook_deliveries_total{outcome="succeeded"} 1');
    expect(exposed).toContain('epay_webhook_deliveries_total{outcome="retrying"} 1');
    expect(exposed).toContain('epay_webhook_deliveries_total{outcome="dead_lettered"} 1');
  });

  it('swallows a dispatch failure so a timer callback cannot crash the process', async () => {
    dispatcher.processDue.mockRejectedValue(new Error('database unavailable'));

    await expect(scheduler.tick()).resolves.toBeUndefined();
    expect(metrics.expose()).toContain('epay_webhook_dispatch_errors_total 1');
  });

  it('skips a tick while the previous pass is still running', async () => {
    let release: (value: WebhookAttemptResult[]) => void = () => undefined;
    dispatcher.processDue.mockImplementation(
      () =>
        new Promise<WebhookAttemptResult[]>((resolve) => {
          release = resolve;
        }),
    );

    const first = scheduler.tick();
    // Second tick arrives while the first is still in flight.
    await scheduler.tick();

    expect(dispatcher.processDue).toHaveBeenCalledTimes(1);
    release([]);
    await first;
  });
});
