import { getContractIds } from './blockchain/contracts';

export interface IndexerConfig {
  stellarNetwork: 'public' | 'testnet' | 'futurenet' | 'sandbox';
  horizonUrl: string;
  sorobanRpcUrl: string;
  databaseUrl: string;
  pollIntervalMs: number;
  batchSize: number;
  confirmationLedgers: number;
  historicalStartLedger: number;
  realtimeEnabled: boolean;
  historicalEnabled: boolean;
  /** Port for `/metrics`, `/health` and `/ready`. Matches the deployed probe. */
  metricsPort: number;
  metricsEnabled: boolean;
  /** Contract ids to subscribe to, derived from the event catalogue. */
  contractIds: string[];
}

export function loadConfig(): IndexerConfig {
  return {
    stellarNetwork:
      (process.env.STELLAR_NETWORK as 'public' | 'testnet' | 'futurenet' | 'sandbox') ?? 'testnet',
    horizonUrl: process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: process.env.STELLAR_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/epay',
    pollIntervalMs: Number(process.env.INDEXER_POLL_INTERVAL_MS ?? 10_000),
    batchSize: Number(process.env.INDEXER_BATCH_SIZE ?? 100),
    confirmationLedgers: Number(process.env.INDEXER_CONFIRMATION_LEDGERS ?? 12),
    historicalStartLedger: Number(process.env.INDEXER_START_LEDGER ?? 0),
    realtimeEnabled: process.env.INDEXER_REALTIME_ENABLED !== 'false',
    historicalEnabled: process.env.INDEXER_HISTORICAL_ENABLED !== 'false',
    metricsPort: Number(process.env.METRICS_PORT ?? 4100),
    metricsEnabled: process.env.INDEXER_METRICS_ENABLED !== 'false',
    // Derived from the single event catalogue in `blockchain/contracts.ts`, so a
    // contract cannot be subscribed here but missing there (or vice versa).
    contractIds: getContractIds(),
  };
}
