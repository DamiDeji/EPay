import { createChildLogger } from '../logger';
import type { IndexerConfig } from '../config';
import type { ParsedEvent } from './contracts';
import { getContractAddresses, parseEvent } from './contracts';
import { CheckpointManager } from '../checkpoint';

const log = createChildLogger('scanner');

/**
 * Block scanner that fetches blocks from the TON blockchain and extracts
 * relevant transactions for our contracts.
 */
export class BlockScanner {
  private readonly config: IndexerConfig;
  private readonly checkpoint: CheckpointManager;
  private readonly contracts: string[];
  private isRunning = false;
  private stopRequested = false;

  constructor(config: IndexerConfig, checkpoint: CheckpointManager) {
    this.config = config;
    this.checkpoint = checkpoint;
    this.contracts = getContractAddresses();
  }

  /**
   * Scan a range of blocks for relevant transactions.
   */
  async scanRange(
    fromBlock: number,
    toBlock: number,
  ): Promise<{ events: ParsedEvent[]; lastBlock: number }> {
    const events: ParsedEvent[] = [];
    const batchSize = this.config.batchSize;

    log.info({ fromBlock, toBlock }, 'Starting block scan');

    for (let block = fromBlock; block <= toBlock; block += batchSize) {
      if (this.stopRequested) break;

      const endBlock = Math.min(block + batchSize - 1, toBlock);

      try {
        const blockEvents = await this.fetchBlockRange(block, endBlock);
        events.push(...blockEvents);
        this.checkpoint.advance(endBlock);

        log.debug(
          { scanned: endBlock, totalBlocks: toBlock - fromBlock, eventsFound: blockEvents.length },
          'Block batch scanned',
        );
      } catch (error) {
        log.error({ block, endBlock, error }, 'Failed to scan block range');
        throw error;
      }
    }

    return { events, lastBlock: toBlock };
  }

  /**
   * Fetch and parse transactions in a block range.
   */
  private async fetchBlockRange(fromBlock: number, toBlock: number): Promise<ParsedEvent[]> {
    const events: ParsedEvent[] = [];
    const endpoint = this.config.tonEndpoint;
    const apiKey = this.config.tonApiKey;

    for (let block = fromBlock; block <= toBlock; block++) {
      try {
        const url = new URL('/api/v2/getBlockTransactions', endpoint);
        url.searchParams.set('workchain', '-1');
        url.searchParams.set('shard', '-9223372036854775808');
        url.searchParams.set('seqno', String(block));

        if (apiKey) {
          url.searchParams.set('api_key', apiKey);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          // If block not available yet, skip
          if (response.status === 404) continue;
          throw new Error(`TON API error: ${response.status}`);
        }

        const data = (await response.json()) as {
          ok: boolean;
          result?: { transactions?: Array<Record<string, unknown>> };
        };

        if (!data.ok || !data.result?.transactions) continue;

        const transactions = data.result.transactions;
        for (const tx of transactions) {
          const txData = tx as {
            transaction_id?: { hash?: string };
            utime?: number;
            in_msg?: { source?: string; message?: string };
          };

          const txHash = txData.transaction_id?.hash ?? '';
          const timestamp = txData.utime ?? 0;
          const sender = txData.in_msg?.source ?? '';

          // Check if this transaction involves our contracts
          const event = parseEvent(
            '', // address would be extracted from the actual tx
            txHash,
            block,
            timestamp,
            sender,
            txData.in_msg?.message ?? '',
          );

          if (event) {
            events.push(event);
          }
        }
      } catch (error) {
        log.error({ block, error }, 'Error fetching block');
      }
    }

    return events;
  }

  /**
   * Get the current chain tip block number.
   */
  async getChainTip(): Promise<number> {
    try {
      const url = `${this.config.tonEndpoint}/api/v2/getMasterchainInfo`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to get chain tip: ${response.status}`);
      }

      const data = (await response.json()) as {
        ok: boolean;
        result?: { last?: { seqno?: number } };
      };

      if (data.ok && data.result?.last?.seqno) {
        return data.result.last.seqno;
      }
    } catch (error) {
      log.error({ error }, 'Failed to get chain tip');
    }

    // Fallback: return current + some buffer
    return this.checkpoint.getCurrentBlock() + 100;
  }

  /**
   * Check if the scanner is currently running.
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Request the scanner to stop.
   */
  stop(): void {
    this.stopRequested = true;
    this.isRunning = false;
    log.info('Scanner stop requested');
  }
}
