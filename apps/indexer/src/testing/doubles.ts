import type { PrismaClient } from '@epay/database';

import type { ContractBinding, ParsedEvent } from '../blockchain/contracts';
import { resolveContracts } from '../blockchain/contracts';
import type { SorobanRpcClient, GetEventsParams, GetEventsResult } from '../blockchain/rpc-client';
import type { BlockScanner, ScanResult } from '../blockchain/scanner';

/**
 * Test doubles for the indexer.
 *
 * The indexer's production code depends on the generated Prisma client so a
 * schema mistake is a compile error. These doubles stand in for it at runtime;
 * the single `as unknown as PrismaClient` cast is confined to this file.
 */

interface IndexerEventRow {
  eventId: string;
  contractName: string;
  eventName: string;
  contractId: string;
  txHash: string;
  ledgerSequence: number;
  occurredAt: Date;
  payload: object;
  appliedAt: Date | null;
  applyAttempts: number;
  applyError: string | null;
}

/** Raised to imitate Prisma's unique-constraint violation. */
export function uniqueViolation(): Error & { code: string } {
  const error = new Error('Unique constraint failed on the fields: (`eventId`)') as Error & {
    code: string;
  };
  error.code = 'P2002';
  return error;
}

export interface FakePrisma {
  client: PrismaClient;
  events: IndexerEventRow[];
  state: Map<string, string>;
  /** Make the next `indexerEvent.create` fail with this error. */
  failNextCreate: (error: Error) => void;
}

/**
 * An in-memory Prisma double that enforces the `eventId` unique constraint.
 *
 * Enforcing uniqueness matters: it is what the idempotency tests actually
 * assert, so a double that ignored it would make those tests vacuous.
 */
export function fakePrisma(): FakePrisma {
  const events: IndexerEventRow[] = [];
  const state = new Map<string, string>();
  // A queue, not a single slot: a test that arms several failures must not have
  // them collapse into one.
  const createErrors: Error[] = [];

  const client = {
    indexerEvent: {
      create: async ({ data }: { data: Partial<IndexerEventRow> }): Promise<IndexerEventRow> => {
        const error = createErrors.shift();
        if (error) throw error;
        if (events.some((row) => row.eventId === data.eventId)) {
          throw uniqueViolation();
        }
        const row: IndexerEventRow = {
          eventId: data.eventId ?? '',
          contractName: data.contractName ?? '',
          eventName: data.eventName ?? '',
          contractId: data.contractId ?? '',
          txHash: data.txHash ?? '',
          ledgerSequence: data.ledgerSequence ?? 0,
          occurredAt: data.occurredAt ?? new Date(0),
          payload: data.payload ?? {},
          appliedAt: data.appliedAt ?? null,
          applyAttempts: 0,
          applyError: null,
        };
        events.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { eventId?: string; key?: string } }) =>
        events.find((row) => row.eventId === where.eventId) ?? null,
      findMany: async (args?: {
        where?: { appliedAt?: null };
        select?: { ledgerSequence?: boolean };
      }) => {
        const rows = events.filter((row) =>
          args?.where?.appliedAt === null ? row.appliedAt === null : true,
        );
        return args?.select?.ledgerSequence
          ? rows.map((row) => ({ ledgerSequence: row.ledgerSequence }))
          : rows;
      },
      count: async () => events.length,
      update: async ({
        where,
        data,
      }: {
        where: { eventId: string };
        data: {
          appliedAt?: Date | null;
          applyError?: string | null;
          applyAttempts?: { increment: number };
        };
      }) => {
        const row = events.find((entry) => entry.eventId === where.eventId);
        if (!row) throw new Error('Record not found');
        if (data.appliedAt !== undefined) row.appliedAt = data.appliedAt;
        if (data.applyError !== undefined) row.applyError = data.applyError;
        if (data.applyAttempts) row.applyAttempts += data.applyAttempts.increment;
        return row;
      },
    },
    indexerState: {
      findUnique: async ({ where }: { where: { key: string } }) => {
        const value = state.get(where.key);
        return value === undefined ? null : { key: where.key, value };
      },
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { key: string };
        update: { value: string };
        create: { key: string; value: string };
      }) => {
        const existing = state.get(where.key);
        state.set(where.key, existing === undefined ? create.value : update.value);
        return { key: where.key, value: state.get(where.key) ?? '' };
      },
    },
  };

  return {
    client: client as unknown as PrismaClient,
    events,
    state,
    failNextCreate: (error: Error) => {
      createErrors.push(error);
    },
  };
}

export interface FakeRpc extends SorobanRpcClient {
  calls: GetEventsParams[];
}

/** A Soroban RPC double that returns queued pages and records the calls made. */
export function fakeRpc(pages: GetEventsResult[] = [], tip = 0): FakeRpc {
  const calls: GetEventsParams[] = [];
  let index = 0;

  return {
    calls,
    getEvents: async (params: GetEventsParams): Promise<GetEventsResult> => {
      calls.push(params);
      const page = pages[index];
      index++;
      return page ?? { events: [], latestLedger: tip };
    },
    getLatestLedger: async (): Promise<number> => tip,
  };
}

export interface FakeScannerOptions {
  chainTip?: number;
  /** Per-call results, consumed in order; the last one repeats. */
  results?: Partial<ScanResult>[];
  /** Throw instead of returning, per call. */
  errors?: (Error | null)[];
}

export interface FakeScanner extends BlockScanner {
  scanCalls: { fromLedger: number; toLedger: number }[];
  tipCalls: number;
}

/** A `BlockScanner` double that replays scripted results. */
export function fakeScanner(options: FakeScannerOptions = {}): FakeScanner {
  const results = options.results ?? [{}];
  const errors = options.errors ?? [];
  const scanCalls: { fromLedger: number; toLedger: number }[] = [];
  let callIndex = 0;
  let tipCalls = 0;

  const fake = {
    scanCalls,
    get tipCalls() {
      return tipCalls;
    },
    scanRange: async (fromLedger: number, toLedger: number): Promise<ScanResult> => {
      scanCalls.push({ fromLedger, toLedger });
      const error = errors[callIndex];
      const result = results[Math.min(callIndex, results.length - 1)] ?? {};
      callIndex++;
      if (error) throw error;
      return {
        events: result.events ?? [],
        latestLedger: result.latestLedger ?? options.chainTip ?? toLedger,
        pagesFetched: result.pagesFetched ?? 1,
        decodeFailures: result.decodeFailures ?? [],
      };
    },
    getChainTip: async (): Promise<number> => {
      tipCalls++;
      return options.chainTip ?? 0;
    },
    stop: () => undefined,
  };

  return fake as unknown as FakeScanner;
}

/** Build a decoded event fixture. */
export function parsedEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    eventId: '0000123456-0000000001',
    contractName: 'PaymentRouter',
    eventName: 'payment_created',
    contractId: 'CDPAYMENTROUTER',
    ledgerSequence: 100,
    timestamp: 1_700_000_000,
    ledgerClosedAt: '2023-11-14T22:13:20.000Z',
    txHash: 'f'.repeat(64),
    known: true,
    fieldNames: ['paymentId'],
    data: { paymentId: '1' },
    topics: ['payment_created'],
    ...overrides,
  };
}

/** The binding set used by the doubles. */
export function testBindings(): ContractBinding[] {
  return resolveContracts({
    PAYMENT_ROUTER_CONTRACT_ID: 'CDPAYMENTROUTER',
  } as NodeJS.ProcessEnv);
}
