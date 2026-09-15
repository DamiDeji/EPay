import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('loadConfig', () => {
  it('defaults to testnet and the local service ports', () => {
    for (const key of [
      'STELLAR_NETWORK',
      'STELLAR_HORIZON_URL',
      'STELLAR_SOROBAN_RPC_URL',
      'DATABASE_URL',
      'INDEXER_BATCH_SIZE',
      'INDEXER_POLL_INTERVAL_MS',
      'INDEXER_CONFIRMATION_LEDGERS',
      'INDEXER_START_LEDGER',
      'METRICS_PORT',
    ]) {
      // `undefined` deletes the variable; an empty string would be a set value.
      vi.stubEnv(key, undefined);
    }

    const config = loadConfig();

    expect(config.stellarNetwork).toBe('testnet');
    expect(config.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(config.batchSize).toBe(100);
    expect(config.pollIntervalMs).toBe(10_000);
    expect(config.confirmationLedgers).toBe(12);
    // The deployed manifests expose metrics on 4100 and probe /health there.
    expect(config.metricsPort).toBe(4100);
  });

  it('reads overrides from the environment', () => {
    vi.stubEnv('STELLAR_NETWORK', 'public');
    vi.stubEnv('INDEXER_BATCH_SIZE', '25');
    vi.stubEnv('INDEXER_CONFIRMATION_LEDGERS', '3');
    vi.stubEnv('INDEXER_START_LEDGER', '900');
    vi.stubEnv('METRICS_PORT', '4200');

    const config = loadConfig();

    expect(config).toMatchObject({
      stellarNetwork: 'public',
      batchSize: 25,
      confirmationLedgers: 3,
      historicalStartLedger: 900,
      metricsPort: 4200,
    });
  });

  it('only treats an explicit "false" as disabling a phase', () => {
    vi.stubEnv('INDEXER_REALTIME_ENABLED', 'false');
    vi.stubEnv('INDEXER_HISTORICAL_ENABLED', 'yes');

    const config = loadConfig();

    expect(config.realtimeEnabled).toBe(false);
    expect(config.historicalEnabled).toBe(true);
  });

  it('can disable the metrics server', () => {
    vi.stubEnv('INDEXER_METRICS_ENABLED', 'false');
    expect(loadConfig().metricsEnabled).toBe(false);
  });

  it('derives the subscribed contracts from the event catalogue', () => {
    vi.stubEnv('PAYMENT_ROUTER_CONTRACT_ID', 'CROUTER');
    vi.stubEnv('ESCROW_MANAGER_CONTRACT_ID', 'CESCROW');
    vi.stubEnv('INVOICE_MANAGER_CONTRACT_ID', '');

    const config = loadConfig();

    expect(config.contractIds).toEqual(['CROUTER', 'CESCROW']);
  });

  it('reports no contracts when none are configured', () => {
    for (const key of [
      'PAYMENT_ROUTER_CONTRACT_ID',
      'INVOICE_MANAGER_CONTRACT_ID',
      'ESCROW_MANAGER_CONTRACT_ID',
      'REFUND_MANAGER_CONTRACT_ID',
      'SUBSCRIPTION_MANAGER_CONTRACT_ID',
      'SETTLEMENT_MANAGER_CONTRACT_ID',
      'MERCHANT_REGISTRY_CONTRACT_ID',
      'TREASURY_VAULT_CONTRACT_ID',
      'FEE_MANAGER_CONTRACT_ID',
      'CONFIGURATION_MANAGER_CONTRACT_ID',
      'EMERGENCY_PAUSE_CONTRACT_ID',
      'ROLE_MANAGER_CONTRACT_ID',
      'UPGRADE_MANAGER_CONTRACT_ID',
      'PRICE_ORACLE_CONTRACT_ID',
      'GOVERNANCE_CONTRACT_ID',
      'IMPACT_NFT_CONTRACT_ID',
    ]) {
      vi.stubEnv(key, undefined);
    }

    expect(loadConfig().contractIds).toEqual([]);
  });
});
