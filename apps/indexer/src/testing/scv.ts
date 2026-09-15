import { Keypair, nativeToScVal, StrKey, xdr } from '@stellar/stellar-sdk';
import type { NativeToScValOpts } from '@stellar/stellar-sdk';

import type { SorobanEventRecord } from '../blockchain/contracts';

/**
 * Fixture helpers that build *real* Soroban XDR.
 *
 * Encoding with the Stellar SDK rather than with hand-written base64 is what
 * makes these tests meaningful: the decoder under test is exercised against the
 * same serialisation a Stellar validator produces, so a mistake in the decoder
 * cannot be cancelled out by a matching mistake in the fixture.
 */

/** The `type` values `nativeToScVal` accepts, taken from the SDK itself. */
type ScValTypeOption = NonNullable<NativeToScValOpts['type']>;

/** Rebuild an `ScVal` from a native JavaScript value. */
function fromNative(value: unknown, type: ScValTypeOption): xdr.ScVal {
  return xdr.ScVal.fromXdrObject(nativeToScVal(value, { type }).toXdrObject());
}

/** A deterministic, checksum-valid ed25519 public key (all-zero key material). */
export const TEST_ADDRESS = StrKey.encodeEd25519PublicKey(new Uint8Array(32));

/** A second deterministic address, distinct from {@link TEST_ADDRESS}. */
export const TEST_ADDRESS_B = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(7));

/** A random, valid keypair address for tests that need an unrelated account. */
export function randomAddress(): string {
  return Keypair.random().publicKey();
}

export const sym = (value: string): xdr.ScVal => fromNative(value, 'symbol');
export const str = (value: string): xdr.ScVal => fromNative(value, 'string');
export const addr = (value: string): xdr.ScVal => fromNative(value, 'address');
export const u32 = (value: number): xdr.ScVal => fromNative(value, 'u32');
export const u64 = (value: bigint): xdr.ScVal => fromNative(value, 'u64');
export const i128 = (value: bigint): xdr.ScVal => fromNative(value, 'i128');
export const bool = (value: boolean): xdr.ScVal => fromNative(value, 'bool');
export const voidSc = (): xdr.ScVal => xdr.ScVal.scvVoid();

/** A tuple as Soroban publishes it: an `ScVec`. */
export const tuple = (values: xdr.ScVal[]): xdr.ScVal => xdr.ScVal.scvVec(values);
export const bytes = (value: Uint8Array): xdr.ScVal => xdr.ScVal.scvBytes(value);

/** Serialise an `ScVal` the way Soroban RPC reports it. */
export const toB64 = (value: xdr.ScVal): string => value.toXdr('base64');

export interface EventRecordOverrides {
  id?: string;
  contractId: string;
  eventName: string;
  /** Data tuple values, in order. */
  data?: xdr.ScVal[];
  ledger?: number;
  ledgerClosedAt?: string;
  txHash?: string;
  type?: string;
  inSuccessfulContractCall?: boolean;
}

/** Build a `SorobanEventRecord` as Soroban RPC would return it. */
export function eventRecord(overrides: EventRecordOverrides): SorobanEventRecord {
  const {
    id = '0000123456-0000000001',
    contractId,
    eventName,
    data = [],
    ledger = 1_234_567,
    ledgerClosedAt = '2026-09-15T12:00:00Z',
    txHash = 'a'.repeat(64),
    type = 'contract',
    inSuccessfulContractCall = true,
  } = overrides;

  return {
    id,
    ledger,
    ledgerClosedAt,
    contractId,
    type,
    topic: [toB64(sym(eventName))],
    value: toB64(tuple(data)),
    txHash,
    inSuccessfulContractCall,
  };
}
