import { describe, expect, it } from 'vitest';

import {
  TEST_ADDRESS,
  TEST_ADDRESS_B,
  addr,
  bytes,
  eventRecord,
  i128,
  str,
  toB64,
  tuple,
  u32,
  u64,
  voidSc,
} from '../testing/scv';

import {
  CONTRACT_SPECS,
  EventDecodeError,
  decodeScVal,
  getContractIds,
  parseEventRecord,
  resolveContracts,
} from './contracts';

const ROUTER = 'CDPAYMENTROUTER000000000000000000000000000000000000000000';
const ESCROW = 'CESCROWMANAGER000000000000000000000000000000000000000000';

const env = {
  PAYMENT_ROUTER_CONTRACT_ID: ROUTER,
  ESCROW_MANAGER_CONTRACT_ID: ESCROW,
} as NodeJS.ProcessEnv;

const bindings = resolveContracts(env);

describe('contract catalogue', () => {
  it('covers all sixteen deployed contracts with unique env vars', () => {
    expect(CONTRACT_SPECS).toHaveLength(16);
    const envVars = CONTRACT_SPECS.map((spec) => spec.envVar);
    expect(new Set(envVars).size).toBe(envVars.length);
  });

  it('documents FeeManager as emitting no events', () => {
    const feeManager = CONTRACT_SPECS.find((spec) => spec.name === 'FeeManager');
    expect(Object.keys(feeManager?.events ?? {})).toHaveLength(0);
  });

  it('returns only configured contract ids', () => {
    expect(getContractIds(env)).toEqual([ROUTER, ESCROW]);
    expect(getContractIds({} as NodeJS.ProcessEnv)).toEqual([]);
  });
});

describe('parseEventRecord', () => {
  it('decodes payment_created and converts the u64 id to a decimal string', () => {
    const parsed = parseEventRecord(
      eventRecord({
        contractId: ROUTER,
        eventName: 'payment_created',
        data: [u64(42n)],
        ledger: 999,
        ledgerClosedAt: '2026-09-15T10:00:00Z',
        txHash: 'deadbeef',
      }),
      bindings,
    );

    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      contractName: 'PaymentRouter',
      eventName: 'payment_created',
      ledgerSequence: 999,
      txHash: 'deadbeef',
      known: true,
      fieldNames: ['paymentId'],
    });
    // A bigint here would make JSON.stringify throw inside BullMQ/Postgres.
    expect(parsed?.data.paymentId).toBe('42');
    expect(typeof parsed?.data.paymentId).toBe('string');
    expect(parsed?.timestamp).toBe(Math.floor(Date.parse('2026-09-15T10:00:00Z') / 1000));
  });

  it('decodes an i128 amount without losing precision', () => {
    const parsed = parseEventRecord(
      eventRecord({
        contractId: ROUTER,
        eventName: 'fee_collected',
        data: [u64(7n), i128(123_456_789_012_345_678_901n)],
      }),
      bindings,
    );

    expect(parsed?.data).toEqual({
      paymentId: '7',
      fee: '123456789012345678901',
    });
  });

  it('decodes address and string payloads', () => {
    const parsed = parseEventRecord(
      eventRecord({
        contractId: ESCROW,
        eventName: 'escrow_created',
        data: [u64(3n), addr(TEST_ADDRESS), addr(TEST_ADDRESS_B), i128(5_000_000n)],
      }),
      bindings,
    );

    expect(parsed?.data).toEqual({
      escrowId: '3',
      merchant: TEST_ADDRESS,
      customer: TEST_ADDRESS_B,
      totalAmount: '5000000',
    });
  });

  it('decodes a multi-value payload in declaration order', () => {
    const parsed = parseEventRecord(
      eventRecord({
        contractId: ROUTER,
        eventName: 'fee_collected',
        data: [i128(1n), i128(2n)],
      }),
      bindings,
    );

    // Fields are positional: the catalogue says (paymentId, fee).
    expect(parsed?.fieldNames).toEqual(['paymentId', 'fee']);
    expect(parsed?.data).toEqual({ paymentId: '1', fee: '2' });
  });

  it('decodes a void payload into an empty data object', () => {
    const pauseBindings = resolveContracts({
      EMERGENCY_PAUSE_CONTRACT_ID: 'CPAUSE',
    } as NodeJS.ProcessEnv);
    const parsed = parseEventRecord(
      eventRecord({
        contractId: 'CPAUSE',
        eventName: 'paused',
        data: [],
      }),
      pauseBindings,
    );

    expect(parsed?.known).toBe(true);
    expect(parsed?.data).toEqual({});
    expect(parsed?.fieldNames).toEqual([]);
  });

  it('decodes a bytes payload to base64 rather than a raw byte array', () => {
    const upgradeBindings = resolveContracts({
      UPGRADE_MANAGER_CONTRACT_ID: 'CUPGRADE',
    } as NodeJS.ProcessEnv);
    const parsed = parseEventRecord(
      eventRecord({
        contractId: 'CUPGRADE',
        eventName: 'upgrade_executed',
        data: [u64(1n), bytes(new Uint8Array([0, 1, 2, 3])), u32(5)],
      }),
      upgradeBindings,
    );

    expect(parsed?.data.wasmHash).toBe('AAECAw==');
    expect(parsed?.data.at).toBe(5);
  });

  it('keeps unknown events but marks them so they are visible, not silent', () => {
    const parsed = parseEventRecord(
      eventRecord({
        contractId: ROUTER,
        eventName: 'something_new_after_upgrade',
        data: [u64(1n), str('hello')],
      }),
      bindings,
    );

    expect(parsed?.known).toBe(false);
    expect(parsed?.eventName).toBe('something_new_after_upgrade');
    expect(parsed?.fieldNames).toEqual(['arg0', 'arg1']);
    expect(parsed?.data).toEqual({ arg0: '1', arg1: 'hello' });
  });

  it('ignores events that are not contract events', () => {
    expect(
      parseEventRecord(
        eventRecord({ contractId: ROUTER, eventName: 'payment_created', type: 'diagnostic' }),
        bindings,
      ),
    ).toBeNull();
  });

  it('ignores events from a call that failed and was rolled back', () => {
    expect(
      parseEventRecord(
        eventRecord({
          contractId: ROUTER,
          eventName: 'payment_completed',
          inSuccessfulContractCall: false,
        }),
        bindings,
      ),
    ).toBeNull();
  });

  it('ignores events from contracts the indexer does not watch', () => {
    expect(
      parseEventRecord(
        eventRecord({ contractId: 'CSOMEONEELSE', eventName: 'payment_created' }),
        bindings,
      ),
    ).toBeNull();
  });

  it('throws a typed error when the payload arity contradicts the catalogue', () => {
    expect(() =>
      parseEventRecord(
        eventRecord({
          contractId: ESCROW,
          eventName: 'escrow_created',
          // The catalogue expects four values.
          data: [u64(1n)],
        }),
        bindings,
      ),
    ).toThrow(EventDecodeError);
  });

  it('throws a typed error when the event name topic is not a symbol', () => {
    const record = eventRecord({ contractId: ROUTER, eventName: 'payment_created' });
    record.topic = [toB64(u64(1n))];

    expect(() => parseEventRecord(record, bindings)).toThrow(EventDecodeError);
  });

  it('throws a typed error when there are no topics', () => {
    const record = eventRecord({ contractId: ROUTER, eventName: 'payment_created' });
    record.topic = [];

    expect(() => parseEventRecord(record, bindings)).toThrow(/no topics/);
  });

  it('throws a typed error on undecodable topic XDR', () => {
    const record = eventRecord({ contractId: ROUTER, eventName: 'payment_created' });
    record.topic = ['not-valid-xdr'];

    expect(() => parseEventRecord(record, bindings)).toThrow(EventDecodeError);
  });

  it('throws a typed error on undecodable value XDR', () => {
    const record = eventRecord({ contractId: ROUTER, eventName: 'payment_created' });
    record.value = '!!!';

    expect(() => parseEventRecord(record, bindings)).toThrow(EventDecodeError);
  });

  it('throws a typed error when the ledger close time is unparseable', () => {
    const record = eventRecord({
      contractId: ROUTER,
      eventName: 'payment_created',
      ledgerClosedAt: 'not-a-date',
      data: [u64(1n)],
    });

    expect(() => parseEventRecord(record, bindings)).toThrow(/ledgerClosedAt/);
  });

  it('carries the event id so replays can be deduplicated', () => {
    const parsed = parseEventRecord(
      eventRecord({
        id: '0000999999-0000000004',
        contractId: ROUTER,
        eventName: 'payment_created',
        data: [u64(1n)],
      }),
      bindings,
    );

    expect(parsed?.eventId).toBe('0000999999-0000000004');
  });

  it('produces a JSON-serialisable event for every catalogued event', () => {
    for (const spec of CONTRACT_SPECS) {
      const singleBindings = resolveContracts({ [spec.envVar]: 'CTEST' } as NodeJS.ProcessEnv);

      for (const [eventName, eventSpec] of Object.entries(spec.events)) {
        const args = eventSpec.fields.map(() => u64(1n));
        const parsed = parseEventRecord(
          eventRecord({ contractId: 'CTEST', eventName, data: args }),
          singleBindings,
        );

        expect(parsed, `${spec.name}.${eventName}`).not.toBeNull();
        expect(parsed?.known, `${spec.name}.${eventName}`).toBe(true);
        expect(Object.keys(parsed?.data ?? {}), `${spec.name}.${eventName}`).toEqual([
          ...eventSpec.fields,
        ]);
        // Must not throw: these events are written to Postgres and journalled.
        expect(() => JSON.stringify(parsed)).not.toThrow();
      }
    }
  });
});

describe('decodeScVal', () => {
  it('decodes a bare symbol', () => {
    expect(decodeScVal(toB64(u64(9n)))).toBe(9n);
  });

  it('decodes a void value', () => {
    expect(decodeScVal(toB64(voidSc()))).toBeNull();
  });

  it('decodes a mixed tuple', () => {
    expect(decodeScVal(toB64(tuple([u64(1n), addr(TEST_ADDRESS)])))).toEqual([1n, TEST_ADDRESS]);
  });
});
