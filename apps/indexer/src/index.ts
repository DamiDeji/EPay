import { prisma } from '@epay/database';

import { HttpSorobanRpcClient } from './blockchain/rpc-client';
import { BlockScanner } from './blockchain/scanner';
import type { CheckpointManager } from './checkpoint';
import { createCheckpointManager } from './checkpoint';
import { loadConfig } from './config';
import type { HealthSnapshot } from './http-server';
import { IndexerHttpServer } from './http-server';
import { logger, createChildLogger } from './logger';
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
      sorobanRpc: config.sorobanRpcUrl,
      pollIntervalMs: config.pollIntervalMs,
      batchSize: config.batchSize,
      confirmationLedgers: config.confirmationLedgers,
      metricsPort: config.metricsPort,
      contractIds: config.contractIds,
    },
    'Configuration loaded',
  );

  if (config.contractIds.length === 0) {
    log.warn(
      'No contract ids are configured, so the indexer will subscribe to nothing. ' +
        'Set PAYMENT_ROUTER_CONTRACT_ID and the other *_CONTRACT_ID variables.',
    );
  }

  const shutdownHandlers: (() => Promise<void>)[] = [];

  let shutDown = false;
  const onShutdown = async (signal: string): Promise<void> => {
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

  process.on('SIGINT', () => {
    void onShutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void onShutdown('SIGTERM');
  });

  try {
    log.info('Connecting to database...');
    await prisma.$connect();
    log.info('Database connected');

    const checkpoint: CheckpointManager = createCheckpointManager(
      prisma,
      config.historicalStartLedger,
    );
    const lastLedger = await checkpoint.load();
    log.info({ lastLedger }, 'Checkpoint loaded');

    const rpc = new HttpSorobanRpcClient({ url: config.sorobanRpcUrl });
    const scanner = new BlockScanner(config, rpc);
    shutdownHandlers.push(async () => {
      scanner.stop();
    });

    let historicalComplete = !config.historicalEnabled;
    let realtime: RealtimeSync | null = null;

    // The health endpoint the deployed liveness/readiness probes hit.
    const httpServer = new IndexerHttpServer({
      port: config.metricsPort,
      health: (): HealthSnapshot => {
        const status = realtime?.getStatus();
        return {
          ready: historicalComplete,
          currentBlock: checkpoint.getCurrentBlock(),
          chainTip: status?.chainTip ?? 0,
          lag: status?.lag ?? 0,
          lastProcessedLedger: checkpoint.getLastFinalizedBlock(),
          consecutiveErrors: status?.consecutiveErrors ?? 0,
        };
      },
    });

    if (config.metricsEnabled) {
      await httpServer.start();
      shutdownHandlers.push(async () => {
        await httpServer.stop();
      });
    } else {
      log.warn('Metrics/health server disabled by INDEXER_METRICS_ENABLED=false');
    }

    // Phase 1: historical catch-up.
    if (config.historicalEnabled) {
      log.info('--- PHASE 1: Historical Sync ---');
      const historicalSync = new HistoricalSync({
        config,
        scanner,
        checkpoint,
        prisma,
        onProgress: (scanned, total) => {
          const pct = total > 0 ? Math.round((scanned / total) * 100) : 0;
          log.info({ scanned, total, pct: `${String(pct)}%` }, 'Historical sync progress');
        },
      });
      shutdownHandlers.push(async () => {
        historicalSync.stop();
      });

      const historicalResult = await historicalSync.run();
      log.info(historicalResult, 'Historical sync complete');
      historicalComplete = true;
    }

    // Phase 2: real-time tail.
    log.info('--- PHASE 2: Real-time Sync ---');
    realtime = new RealtimeSync({
      config,
      scanner,
      checkpoint,
      prisma,
      onBlockProcessed: (ledger, eventCount) => {
        if (eventCount > 0) {
          log.debug({ ledger, eventCount }, 'Ledger processed in real-time');
        }
      },
      onError: (error, ledger) => {
        log.error({ error: error.message, ledger }, 'Real-time sync error');
      },
    });
    shutdownHandlers.push(async () => {
      await realtime?.stop();
    });

    await realtime.start();

    const statusInterval = setInterval(() => {
      const status = realtime?.getStatus();
      if (status) {
        log.info(
          { ...status, uptime: `${String(Math.round(process.uptime()))}s` },
          'Indexer status',
        );
      }
    }, 60_000);

    shutdownHandlers.push(async () => {
      clearInterval(statusInterval);
    });

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
