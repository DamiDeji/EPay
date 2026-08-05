import { loadConfig } from './config';
import { logger, createChildLogger } from './logger';
import { BlockScanner } from './blockchain/scanner';
import { createCheckpointManager } from './checkpoint';
import { HistoricalSync } from './sync/historical';
import { RealtimeSync } from './sync/realtime';
import { IndexerQueue } from './queue/queue';
import { prisma } from '@epay/database';

const log = createChildLogger('main');

async function main(): Promise<void> {
  log.info('=======================================');
  log.info('  EPay Blockchain Indexer');
  log.info('=======================================');

  const config = loadConfig();
  log.info(
    {
      network: config.tonNetwork,
      endpoint: config.tonEndpoint,
      pollIntervalMs: config.pollIntervalMs,
      batchSize: config.batchSize,
      confirmationBlocks: config.confirmationBlocks,
    },
    'Configuration loaded',
  );

  // Set up graceful shutdown handler
  const shutdownHandlers: Array<() => Promise<void>> = [];

  let shutDown = false;
  const onShutdown = async (signal: string) => {
    if (shutDown) return;
    shutDown = true;
    log.info({ signal }, 'Received shutdown signal');
    for (const handler of shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        log.error({ error }, 'Error during shutdown handler');
      }
    }
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => onShutdown('SIGINT'));
  process.on('SIGTERM', () => onShutdown('SIGTERM'));

  try {
    // Connect to the database
    log.info('Connecting to database...');
    await prisma.$connect();
    log.info('Database connected');

    // Initialize checkpoint manager with real Prisma
    const checkpoint = await createCheckpointManager(prisma, config.historicalStartBlock);
    const lastBlock = await checkpoint.load();
    log.info({ lastBlock }, 'Checkpoint loaded');

    // Initialize scanner
    const scanner = new BlockScanner(config, checkpoint);
    shutdownHandlers.push(async () => {
      scanner.stop();
    });

    // Initialize BullMQ queue
    const queue = new IndexerQueue(config, prisma);
    queue.startWorker();
    shutdownHandlers.push(async () => {
      await queue.shutdown();
    });

    // ====================================================================
    // PHASE 1: Historical sync — catch up from last checkpoint
    // ====================================================================
    log.info('--- PHASE 1: Historical Sync ---');
    const historicalSync = new HistoricalSync({
      config,
      scanner,
      checkpoint,
      prisma,
      onProgress: (scanned, total) => {
        const pct = total > 0 ? Math.round((scanned / total) * 100) : 0;
        log.info({ scanned, total, pct: `${pct}%` }, 'Historical sync progress');
      },
    });
    shutdownHandlers.push(async () => {
      historicalSync.stop();
    });

    const historicalResult = await historicalSync.run();
    log.info(
      {
        blocksProcessed: historicalResult.blocksProcessed,
        eventsFound: historicalResult.eventsFound,
        durationMs: historicalResult.durationMs,
      },
      'Historical sync complete',
    );

    // ====================================================================
    // PHASE 2: Real-time sync — continuously poll for new blocks
    // ====================================================================
    log.info('--- PHASE 2: Real-time Sync ---');
    const realtimeSync = new RealtimeSync({
      config,
      scanner,
      checkpoint,
      prisma,
      onBlockProcessed: async (block, eventCount) => {
        if (eventCount > 0) {
          try {
            const stats = await queue.getStats();
            log.debug(
              { block, eventCount, queueStats: stats },
              'Block processed in real-time',
            );
          } catch {
            // queue stats may be unavailable; ignore
          }
        }
      },
      onError: (error, block) => {
        log.error({ error: error.message, block }, 'Real-time sync error');
      },
    });
    shutdownHandlers.push(async () => {
      await realtimeSync.stop();
    });

    await realtimeSync.start();

    // ====================================================================
    // Health check: log status periodically
    // ====================================================================
    const healthInterval = setInterval(async () => {
      try {
        const status = await realtimeSync.getStatus();
        const queueStats = await queue.getStats();

        log.info(
          {
            syncStatus: status,
            queueStats,
            uptime: `${Math.round(process.uptime())}s`,
          },
          'Indexer health check',
        );
      } catch (error) {
        log.error({ error }, 'Health check failed');
      }
    }, 60_000);

    shutdownHandlers.push(async () => {
      clearInterval(healthInterval);
    });

    log.info('=======================================');
    log.info('  EPay Indexer is running');
    log.info('  Press Ctrl+C to stop');
    log.info('=======================================');
  } catch (error) {
    log.error({ error }, 'Fatal error during indexer startup');
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run the indexer
main().catch((error) => {
  logger.error({ error }, 'Unhandled error in main');
  process.exit(1);
});
