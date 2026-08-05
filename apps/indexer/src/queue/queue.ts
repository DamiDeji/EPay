import { Queue, Worker, type Job } from 'bullmq';
import { createChildLogger } from '../logger';
import type { IndexerConfig } from '../config';
import type { ParsedEvent } from '../blockchain/contracts';
import { dispatchEvent } from '../handlers/dispatcher';

const log = createChildLogger('queue');

export interface IndexerJob {
  event: ParsedEvent;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

const QUEUE_NAME = 'epay-indexer-events';

/**
 * Generate a unique job ID for an event with collision resistance.
 */
function makeJobId(event: ParsedEvent): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${event.txHash}-${event.eventName}-${rnd}`;
}

/**
 * BullMQ queue for asynchronous event processing.
 */
export class IndexerQueue {
  private queue: Queue<IndexerJob>;
  private worker: Worker<IndexerJob> | null = null;
  private readonly prisma: any;
  private readonly config: IndexerConfig;
  private workerReady = false;

  constructor(config: IndexerConfig, prisma: any) {
    this.config = config;
    this.prisma = prisma;

    this.queue = new Queue<IndexerJob>(QUEUE_NAME, {
      connection: {
        url: config.redisUrl,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });

    // Handle queue connection errors
    this.queue.on('error', (error) => {
      log.error({ error: error.message }, 'Queue connection error');
    });

    this.queue.on('waiting', (jobId) => {
      log.debug({ jobId }, 'Job waiting in queue');
    });

    log.info('Indexer queue initialized');
  }

  async enqueueEvent(event: ParsedEvent): Promise<string> {
    const job = await this.queue.add('process-event', { event }, {
      jobId: makeJobId(event),
    });

    log.debug(
      { jobId: job.id, contractName: event.contractName, eventName: event.eventName },
      'Event enqueued',
    );

    return job.id ?? '';
  }

  async enqueueEvents(events: ParsedEvent[]): Promise<string[]> {
    const jobs = events.map((event) => ({
      name: 'process-event' as const,
      data: { event } satisfies IndexerJob,
      opts: { jobId: makeJobId(event) },
    }));

    const added = await this.queue.addBulk(jobs);
    log.debug({ count: added.length }, 'Events enqueued in bulk');
    return added.map((j) => j.id ?? '');
  }

  startWorker(): void {
    this.worker = new Worker<IndexerJob>(
      QUEUE_NAME,
      async (job: Job<IndexerJob>) => {
        const { event } = job.data;

        log.debug(
          { jobId: job.id, contractName: event.contractName, eventName: event.eventName },
          'Processing event',
        );

        await dispatchEvent(event, this.prisma);

        log.debug(
          { jobId: job.id, attempts: job.attemptsMade },
          'Event processed successfully',
        );
      },
      {
        connection: {
          url: this.config.redisUrl,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
        concurrency: 5,
        limiter: {
          max: 50,
          duration: 1000,
        },
      },
    );

    this.worker.on('completed', (job) => {
      log.debug({ jobId: job.id }, 'Job completed');
    });

    this.worker.on('failed', (job, error) => {
      log.error(
        { jobId: job?.id, error: error.message, attempts: job?.attemptsMade },
        'Job failed',
      );
    });

    this.worker.on('error', (error) => {
      log.error({ error: error.message }, 'Worker error');
    });

    this.worker.on('ready', () => {
      this.workerReady = true;
      log.info('Worker connected to Redis and ready');
    });

    this.worker.on('closing', () => {
      log.info('Worker closing');
    });

    log.info({ concurrency: 5 }, 'Indexer worker started');
  }

  /**
   * Returns whether the worker is connected and ready.
   */
  isReady(): boolean {
    return this.workerReady;
  }

  async getStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async cleanOldJobs(graceMs: number = 86_400_000): Promise<void> {
    await Promise.all([
      this.queue.clean(graceMs, 10_000, 'completed'),
      this.queue.clean(graceMs, 5_000, 'failed'),
    ]);
    log.info({ graceMs }, 'Cleaned old jobs');
  }

  async pause(): Promise<void> {
    await this.queue.pause();
    await this.worker?.pause();
    log.info('Queue paused');
  }

  async resume(): Promise<void> {
    await this.queue.resume();
    await this.worker?.resume();
    log.info('Queue resumed');
  }

  async shutdown(): Promise<void> {
    log.info('Shutting down indexer queue');
    try {
      await this.worker?.close();
    } catch (error) {
      log.error({ error }, 'Error closing worker');
    }
    try {
      await this.queue.close();
    } catch (error) {
      log.error({ error }, 'Error closing queue');
    }
    log.info('Indexer queue shut down');
  }
}
