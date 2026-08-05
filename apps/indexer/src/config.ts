export interface IndexerConfig {
  tonEndpoint: string;
  tonNetwork: 'mainnet' | 'testnet';
  tonApiKey?: string;
  redisUrl: string;
  databaseUrl: string;
  pollIntervalMs: number;
  batchSize: number;
  confirmationBlocks: number;
  historicalStartBlock: number;
  realtimeEnabled: boolean;
  historicalEnabled: boolean;
}

export function loadConfig(): IndexerConfig {
  return {
    tonEndpoint: process.env.TON_ENDPOINT ?? 'https://toncenter.com/api/v2/jsonRPC',
    tonNetwork: (process.env.TON_NETWORK as 'mainnet' | 'testnet') ?? 'testnet',
    tonApiKey: process.env.TON_API_KEY,
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/epay',
    pollIntervalMs: Number(process.env.INDEXER_POLL_INTERVAL_MS ?? 10_000),
    batchSize: Number(process.env.INDEXER_BATCH_SIZE ?? 100),
    confirmationBlocks: Number(process.env.INDEXER_CONFIRMATION_BLOCKS ?? 20),
    historicalStartBlock: Number(process.env.INDEXER_START_BLOCK ?? 0),
    realtimeEnabled: process.env.INDEXER_REALTIME_ENABLED !== 'false',
    historicalEnabled: process.env.INDEXER_HISTORICAL_ENABLED !== 'false',
  };
}
