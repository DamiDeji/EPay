export interface IndexerConfig {
  stellarNetwork: 'public' | 'testnet' | 'futurenet' | 'sandbox';
  horizonUrl: string;
  sorobanRpcUrl: string;
  redisUrl: string;
  databaseUrl: string;
  pollIntervalMs: number;
  batchSize: number;
  confirmationLedgers: number;
  historicalStartLedger: number;
  realtimeEnabled: boolean;
  historicalEnabled: boolean;
  contractIds: string[];
}

export function loadConfig(): IndexerConfig {
  return {
    stellarNetwork: (process.env.STELLAR_NETWORK as 'public' | 'testnet' | 'futurenet' | 'sandbox') ?? 'testnet',
    horizonUrl: process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: process.env.STELLAR_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/epay',
    pollIntervalMs: Number(process.env.INDEXER_POLL_INTERVAL_MS ?? 10_000),
    batchSize: Number(process.env.INDEXER_BATCH_SIZE ?? 100),
    confirmationLedgers: Number(process.env.INDEXER_CONFIRMATION_LEDGERS ?? 12),
    historicalStartLedger: Number(process.env.INDEXER_START_LEDGER ?? 0),
    realtimeEnabled: process.env.INDEXER_REALTIME_ENABLED !== 'false',
    historicalEnabled: process.env.INDEXER_HISTORICAL_ENABLED !== 'false',
    contractIds: [
      process.env.PAYMENT_ROUTER_CONTRACT_ID ?? '',
      process.env.MERCHANT_REGISTRY_CONTRACT_ID ?? '',
      process.env.INVOICE_MANAGER_CONTRACT_ID ?? '',
      process.env.ESCROW_MANAGER_CONTRACT_ID ?? '',
      process.env.SUBSCRIPTION_MANAGER_CONTRACT_ID ?? '',
      process.env.REFUND_MANAGER_CONTRACT_ID ?? '',
      process.env.TREASURY_VAULT_CONTRACT_ID ?? '',
    ].filter(Boolean),
  };
}
