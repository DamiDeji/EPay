import type { CheckpointManager } from '../checkpoint';
import type { IndexerConfig } from '../config';
import { createChildLogger } from '../logger';

import type { ParsedEvent } from './contracts';
import { getContractIds, parseEvent } from './contracts';

const log = createChildLogger('scanner');

/**
 * Ledger scanner that polls the Stellar Horizon API for transactions
 * involving our Soroban smart contracts.
 */
export class BlockScanner {
  private readonly config: IndexerConfig;
  private readonly checkpoint: CheckpointManager;
  private readonly contractIds: string[];
  private isRunning = false;
  private stopRequested = false;

  constructor(config: IndexerConfig, checkpoint: CheckpointManager) {
    this.config = config;
    this.checkpoint = checkpoint;
    this.contractIds = getContractIds();
  }

  /**
   * Scan a range of ledgers for relevant transactions.
   */
  async scanRange(
    fromLedger: number,
    toLedger: number,
  ): Promise<{ events: ParsedEvent[]; lastLedger: number }> {
    const events: ParsedEvent[] = [];
    const batchSize = this.config.batchSize;

    log.info({ fromLedger, toLedger }, 'Starting ledger scan');

    for (let ledger = fromLedger; ledger <= toLedger; ledger += batchSize) {
      if (this.stopRequested) break;

      const endLedger = Math.min(ledger + batchSize - 1, toLedger);

      try {
        const ledgerEvents = await this.fetchLedgerRange(ledger, endLedger);
        events.push(...ledgerEvents);
        this.checkpoint.advance(endLedger);

        log.debug(
          { scanned: endLedger, totalLedgers: toLedger - fromLedger, eventsFound: ledgerEvents.length },
          'Ledger batch scanned',
        );
      } catch (error) {
        log.error({ ledger, endLedger, error }, 'Failed to scan ledger range');
        throw error;
      }
    }

    return { events, lastLedger: toLedger };
  }

  /**
   * Fetch and parse transactions in a ledger range.
   */
  private async fetchLedgerRange(fromLedger: number, toLedger: number): Promise<ParsedEvent[]> {
    const events: ParsedEvent[] = [];
    const horizonUrl = this.config.horizonUrl;

    for (let ledger = fromLedger; ledger <= toLedger; ledger++) {
      try {
        // Fetch transactions for this ledger from Horizon
        const url = `${horizonUrl}/ledgers/${ledger}/transactions?limit=200&include_failed=false`;
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) continue; // Ledger not available yet
          throw new Error(`Horizon API error: ${response.status}`);
        }

        const data = (await response.json()) as {
          _embedded?: {
            records?: TxRecord[];
          };
        };

        const records = data._embedded?.records ?? [];

        for (const tx of records) {
          // Check if transaction involves our contracts
          const contractEvents = await this.extractContractEvents(
            horizonUrl,
            tx,
            ledger,
          );
          events.push(...contractEvents);
        }
      } catch (error) {
        log.error({ ledger, error }, 'Error fetching ledger');
      }
    }

    return events;
  }

  /**
   * Extract Soroban contract events from a transaction.
   */
  private async extractContractEvents(
    horizonUrl: string,
    tx: TxRecord,
    ledger: number,
  ): Promise<ParsedEvent[]> {
    const events: ParsedEvent[] = [];

    // Check operations for contract invocations
    try {
      const opsUrl = `${horizonUrl}/transactions/${tx.id}/operations?limit=200`;
      const opsResponse = await fetch(opsUrl);

      if (!opsResponse.ok) return events;

      const opsData = (await opsResponse.json()) as {
        _embedded?: {
          records?: OpRecord[];
        };
      };

      const operations = opsData._embedded?.records ?? [];

      for (const op of operations) {
        if (op.type === 'invoke_host_function') {
          // Check if this operation involves our contracts
          for (const contractId of this.contractIds) {
            // Build structured event from operation
            const event = parseEvent(
              contractId,
              tx.id,
              ledger,
              Date.parse(tx.created_at) / 1000,
              tx.source_account,
              [], // Event topics would come from Soroban diagnostic events
              {
                txId: tx.id,
                sourceAccount: tx.source_account,
                feeCharged: tx.fee_charged,
                operationCount: tx.operation_count,
                memo: tx.memo,
              },
            );

            if (event) {
              events.push(event);
            }
          }
        }
      }
    } catch {
      // Ignore errors fetching operations for individual transactions
    }

    return events;
  }

  /**
   * Get the current chain tip (latest ledger).
   */
  async getChainTip(): Promise<number> {
    try {
      const url = this.config.horizonUrl;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to get Horizon root: ${response.status}`);
      }

      const data = (await response.json()) as {
        history_latest_ledger?: number;
        core_latest_ledger?: number;
      };

      return data.core_latest_ledger ?? data.history_latest_ledger ?? 0;
    } catch (error) {
      log.error({ error }, 'Failed to get chain tip');
    }

    return this.checkpoint.getCurrentBlock() + 100;
  }

  get running(): boolean {
    return this.isRunning;
  }

  stop(): void {
    this.stopRequested = true;
    this.isRunning = false;
    log.info('Scanner stop requested');
  }
}

// ── Horizon API Types ───────────────────────────────────────────────────────

interface TxRecord {
  id: string;
  source_account: string;
  fee_charged: number;
  operation_count: number;
  created_at: string;
  memo?: string;
  memo_type?: string;
}

interface OpRecord {
  id: string;
  type: string;
  source_account?: string;
}
