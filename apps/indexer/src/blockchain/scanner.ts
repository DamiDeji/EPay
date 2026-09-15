import type { IndexerConfig } from '../config';
import { createChildLogger } from '../logger';

import type { ContractBinding, ParsedEvent } from './contracts';
import { EventDecodeError, parseEventRecord, resolveContracts } from './contracts';
import type { SorobanRpcClient } from './rpc-client';

const log = createChildLogger('scanner');

/** Cap on `getEvents` pages fetched for a single range, to bound a runaway loop. */
const MAX_PAGES_PER_RANGE = 1000;

export interface DecodeFailure {
  recordId: string;
  reason: string;
}

export interface ScanResult {
  events: ParsedEvent[];
  /** Chain tip reported by the last page, so callers need not re-poll. */
  latestLedger: number;
  pagesFetched: number;
  /**
   * Records that belonged to a watched contract but could not be decoded.
   * Reported rather than thrown: a single malformed event must not stall a
   * ledger, but it must also never disappear silently.
   */
  decodeFailures: DecodeFailure[];
}

/**
 * Reads EPay's Soroban contract events for a ledger range.
 *
 * Events come from Soroban RPC's `getEvents`; Horizon does not expose contract
 * events at all. The scanner never advances the checkpoint — that is the sync
 * engine's job, and only after the batch has been projected, so a failure can
 * never silently skip a ledger.
 */
export class BlockScanner {
  private readonly config: IndexerConfig;
  private readonly rpc: SorobanRpcClient;
  private readonly bindings: ContractBinding[];
  private readonly contractIds: string[];
  private stopRequested = false;

  constructor(config: IndexerConfig, rpc: SorobanRpcClient) {
    this.config = config;
    this.rpc = rpc;
    this.bindings = resolveContracts();
    this.contractIds = this.bindings
      .map((binding) => binding.contractId)
      .filter((id) => id.length > 0);
  }

  /**
   * Fetch every decoded event in `[fromLedger, toLedger]`.
   *
   * @throws {SorobanRpcError} when the RPC is unavailable after retries. The
   * caller must not advance the checkpoint when this rejects.
   */
  async scanRange(fromLedger: number, toLedger: number): Promise<ScanResult> {
    const events: ParsedEvent[] = [];
    const decodeFailures: DecodeFailure[] = [];

    if (toLedger < fromLedger) {
      return { events, latestLedger: fromLedger, pagesFetched: 0, decodeFailures };
    }

    if (this.contractIds.length === 0) {
      log.warn(
        'No contract ids configured; subscribe to nothing. Set PAYMENT_ROUTER_CONTRACT_ID and friends.',
      );
      const latestLedger = await this.rpc.getLatestLedger();
      return { events, latestLedger, pagesFetched: 0, decodeFailures };
    }

    let cursor: string | undefined;
    let latestLedger = fromLedger;
    let pagesFetched = 0;

    for (let page = 0; page < MAX_PAGES_PER_RANGE; page++) {
      if (this.stopRequested) break;

      const result = await this.rpc.getEvents({
        startLedger: fromLedger,
        contractIds: this.contractIds,
        limit: Math.min(this.config.batchSize * 10, 10_000),
        ...(cursor ? { cursor } : {}),
      });

      pagesFetched++;
      latestLedger = result.latestLedger || latestLedger;

      for (const record of result.events) {
        // `getEvents` only filters from the bottom of the range, so the top is
        // enforced here.
        if (record.ledger > toLedger) continue;

        try {
          const parsed = parseEventRecord(record, this.bindings);
          if (parsed) events.push(parsed);
        } catch (error) {
          const failure: DecodeFailure = {
            recordId: record.id,
            reason:
              error instanceof EventDecodeError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : String(error),
          };
          decodeFailures.push(failure);
          log.error(failure, 'Failed to decode contract event');
        }
      }

      const lastRecord = result.events.at(-1);
      if (!result.cursor || !lastRecord || lastRecord.ledger > toLedger) break;
      cursor = result.cursor;
    }

    log.debug(
      {
        fromLedger,
        toLedger,
        events: events.length,
        pagesFetched,
        decodeFailures: decodeFailures.length,
      },
      'Scanned ledger range',
    );

    return { events, latestLedger, pagesFetched, decodeFailures };
  }

  /**
   * Current chain tip.
   *
   * @throws {SorobanRpcError} on failure. This deliberately does *not* fall back
   * to a guessed height: a fabricated tip makes the indexer look caught-up while
   * it is not, which is worse than reporting the outage.
   */
  async getChainTip(): Promise<number> {
    return this.rpc.getLatestLedger();
  }

  stop(): void {
    this.stopRequested = true;
    log.info('Scanner stop requested');
  }
}
