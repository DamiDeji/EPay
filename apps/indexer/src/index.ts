import { prisma } from '@epay/database';

import { BlockScanner } from './blockchain/scanner';
import { createCheckpointManager } from './checkpoint';
import { loadConfig } from './config';
import { logger, createChildLogger } from './logger';
import { IndexerQueue } from './queue/queue';
import { HistoricalSync } from './sync/historical';
import { RealtimeSync } from './sync/realtime';

const log = createChildLogger('main');

async function main(): Promise<void> {
  log.info('=======================================');
  log.info('  EPay Stellar Indexer');
  log.info('=======================================');

  const config = loadConfig();
  log.info(
    {
      network: config.stellarNetwork,
      horizon: config.horizonUrl,
      sorobanRpc: config.sorobanRpcUrl,
      pollIntervalMs: config.pollIntervalMs,
      batchSize: config.batchSize,
      confirmationLedgers: config.confirmationLedgers,
      contractIds: config.contractIds,
    },
    'Configuration loaded',
  );

  const shutdownHandlers: (() => Promise<void>)[] = [];

  let shutDown = false;
  const onShutdown = async (signal: string) => {
    if (shutDown) return;
    shutDown = true;
    log.info({ signal }, 'Received shutdown signal');
    for (const handler of shutdownHandlers) {
      try {
        await handler();
      } catch (error: unknown) {
        log.error({ error }, 'Error during shutdown handler');
      }
    }
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => { void onShutdown('SIGINT'); });
  process.on('SIGTERM', () => { void onShutdown('SIGTERM'); });

  try {
    log.info('Connecting to database...');
    await prisma.$connect();
    log.info('Database connected');

    const checkpoint = await createCheckpointManager(prisma, config.historicalStartLedger);
    const lastLedger = await checkpoint.load();
    log.info({ lastLedger }, 'Checkpoint loaded');

    const scanner = new BlockScanner(config, checkpoint);
    shutdownHandlers.push(async () => { scanner.stop(); });

    const queue = new IndexerQueue(config, prisma);
    queue.startWorker();
    shutdownHandlers.push(async () => { await queue.shutdown(); });

    // Phase 1: Historical sync
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
    shutdownHandlers.push(async () => { historicalSync.stop(); });

    const historicalResult = await historicalSync.run();
    log.info(
      {
        ledgersProcessed: historicalResult.blocksProcessed,
        eventsFound: historicalResult.eventsFound,
        durationMs: historicalResult.durationMs,
      },
      'Historical sync complete',
    );

    // Phase 2: Real-time sync
    log.info('--- PHASE 2: Real-time Sync ---');
    const realtimeSync = new RealtimeSync({
      config,
      scanner,
      checkpoint,
      prisma,
      onLedgerProcessed: (ledger, eventCount) => { void (async () => {
        if (eventCount > 0) {
          try {
            const stats = await queue.getStats();
            log.debug({ ledger, eventCount, queueStats: stats }, 'Ledger processed in real-time');
          } catch { /* queue stats may be unavailable */ }
        }
      })(); },
      onError: (error, ledger) => {
        log.error({ error: error.message, ledger }, 'Real-time sync error');
      },
    });
    shutdownHandlers.push(async () => { await realtimeSync.stop(); });

    await realtimeSync.start();

    // Health check
    const healthInterval = setInterval(() => { void (async () => {
      try {
        const status = await realtimeSync.getStatus();
        const queueStats = await queue.getStats();
        log.info({ syncStatus: status, queueStats, uptime: `${Math.round(process.uptime())}s` }, 'Indexer health check');
      } catch (error: unknown) {
        log.error({ error }, 'Health check failed');
      }
    })(); }, 60_000);

    shutdownHandlers.push(async () => { clearInterval(healthInterval); });

    log.info('=======================================');
    log.info('  EPay Stellar Indexer is running');
    log.info('  Press Ctrl+C to stop');
    log.info('=======================================');
  } catch (error: unknown) {
    log.error({ error }, 'Fatal error during indexer startup');
    await prisma.$disconnect();
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  logger.error({ error }, 'Unhandled error in main');
  process.exit(1);
});
