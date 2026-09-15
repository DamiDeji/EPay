import { scValToNative, xdr } from '@stellar/stellar-sdk';

/**
 * Event decoding for EPay's Soroban contracts.
 *
 * Soroban contract events are *not* visible through Horizon's transaction or
 * operation endpoints; they are served by Soroban RPC's `getEvents` method as
 * XDR-encoded base64 `topic`/`value` fields. This module turns those records
 * into typed {@link ParsedEvent}s using the catalogue in
 * `packages/contracts/EVENTS.md`, which mirrors the `env.events().publish(...)`
 * calls in each contract.
 *
 * Keeping the catalogue here (rather than inferring names per handler) means an
 * event that is renamed on chain surfaces as an unknown event instead of being
 * silently dropped.
 */

/** A record as returned in Soroban RPC `getEvents`' `events` array. */
export interface SorobanEventRecord {
  /** Globally unique, ordered event id, e.g. `0000123456-0000000001`. */
  id: string;
  /** Ledger sequence the event was emitted in. */
  ledger: number;
  /** Ledger close time, ISO-8601. */
  ledgerClosedAt: string;
  contractId: string;
  /** `contract`, `diagnostic` or `system`. */
  type: string;
  /** Base64 XDR `ScVal`s. `topic[0]` is the event name. */
  topic: string[];
  /** Base64 XDR `ScVal` holding the event's data tuple. */
  value: string;
  txHash: string;
  /** Soroban only surfaces events from successful calls; failed calls roll back. */
  inSuccessfulContractCall: boolean;
}

export interface ContractEventSpec {
  /** Field names of the event's data tuple, in order. */
  readonly fields: readonly string[];
}

export interface ContractSpec {
  readonly name: string;
  /** Environment variable holding the deployed contract id. */
  readonly envVar: string;
  /** Event name (first topic) → data payload shape. */
  readonly events: Readonly<Record<string, ContractEventSpec>>;
}

/**
 * The event catalogue, mirroring `packages/contracts/EVENTS.md`.
 *
 * `FeeManager` is listed with no events on purpose: changing a fee emits
 * nothing, because the effect shows up as `fee_collected` on the next payment.
 */
export const CONTRACT_SPECS: readonly ContractSpec[] = [
  {
    name: 'PaymentRouter',
    envVar: 'PAYMENT_ROUTER_CONTRACT_ID',
    events: {
      payment_created: { fields: ['paymentId'] },
      payment_confirmed: { fields: ['paymentId'] },
      payment_completed: { fields: ['paymentId'] },
      fee_collected: { fields: ['paymentId', 'fee'] },
      payment_failed: { fields: ['paymentId'] },
      payment_refunded: { fields: ['paymentId', 'refundable'] },
    },
  },
  {
    name: 'InvoiceManager',
    envVar: 'INVOICE_MANAGER_CONTRACT_ID',
    events: {
      invoice_created: { fields: ['invoiceId', 'amount'] },
      invoice_issued: { fields: ['invoiceId'] },
      invoice_paid: { fields: ['invoiceId'] },
      invoice_cancelled: { fields: ['invoiceId'] },
    },
  },
  {
    name: 'EscrowManager',
    envVar: 'ESCROW_MANAGER_CONTRACT_ID',
    events: {
      escrow_created: { fields: ['escrowId', 'merchant', 'customer', 'totalAmount'] },
      escrow_funded: { fields: ['escrowId'] },
      escrow_completed: { fields: ['escrowId'] },
      escrow_disputed: { fields: ['escrowId'] },
      escrow_resolved: { fields: ['escrowId'] },
      escrow_cancelled: { fields: ['escrowId'] },
      escrow_refunded: { fields: ['escrowId'] },
    },
  },
  {
    name: 'RefundManager',
    envVar: 'REFUND_MANAGER_CONTRACT_ID',
    events: {
      refund_requested: { fields: ['refundId', 'paymentId', 'amount'] },
      refund_approved: { fields: ['refundId'] },
      refund_completed: { fields: ['refundId'] },
      refund_rejected: { fields: ['refundId'] },
    },
  },
  {
    name: 'SubscriptionManager',
    envVar: 'SUBSCRIPTION_MANAGER_CONTRACT_ID',
    events: {
      sub_created: { fields: ['subId'] },
      sub_renewed: { fields: ['subId'] },
      sub_paused: { fields: ['subId'] },
      sub_cancelled: { fields: ['subId'] },
    },
  },
  {
    name: 'SettlementManager',
    envVar: 'SETTLEMENT_MANAGER_CONTRACT_ID',
    events: {
      settlement_created: { fields: ['settlementId'] },
      settlement_done: { fields: ['settlementId'] },
    },
  },
  {
    name: 'MerchantRegistry',
    envVar: 'MERCHANT_REGISTRY_CONTRACT_ID',
    events: {
      merchant_reg: { fields: ['merchantId'] },
      merchant_verified: { fields: ['merchantId'] },
      merchant_suspended: { fields: ['merchantId'] },
      merchant_react: { fields: ['merchantId'] },
    },
  },
  {
    name: 'TreasuryVault',
    envVar: 'TREASURY_VAULT_CONTRACT_ID',
    events: {
      treasury_deposit: { fields: ['txId'] },
      treasury_withdraw: { fields: ['txId'] },
      treasury_tx_recorded: { fields: ['txId'] },
    },
  },
  {
    name: 'FeeManager',
    envVar: 'FEE_MANAGER_CONTRACT_ID',
    events: {},
  },
  {
    name: 'ConfigurationManager',
    envVar: 'CONFIGURATION_MANAGER_CONTRACT_ID',
    events: {
      config_updated: { fields: [] },
    },
  },
  {
    name: 'EmergencyPause',
    envVar: 'EMERGENCY_PAUSE_CONTRACT_ID',
    events: {
      paused: { fields: [] },
      unpaused: { fields: [] },
    },
  },
  {
    name: 'RoleManager',
    envVar: 'ROLE_MANAGER_CONTRACT_ID',
    events: {
      role_assigned: { fields: ['target', 'role'] },
      role_revoked: { fields: ['target', 'role'] },
    },
  },
  {
    name: 'UpgradeManager',
    envVar: 'UPGRADE_MANAGER_CONTRACT_ID',
    events: {
      admin_transfer_proposed: { fields: ['caller', 'newAdmin'] },
      admin_transfer_completed: { fields: ['caller'] },
      admin_transfer_cancelled: { fields: [] },
      upgrade_proposed: { fields: ['proposalId', 'caller', 'executableAt'] },
      upgrade_executed: { fields: ['proposalId', 'wasmHash', 'at'] },
      upgrade_cancelled: { fields: ['proposalId'] },
    },
  },
  {
    name: 'PriceOracle',
    envVar: 'PRICE_ORACLE_CONTRACT_ID',
    events: {
      price_updated: { fields: ['pair', 'price', 'decimals', 'source', 'at'] },
      oracle_added: { fields: ['oracle', 'assetPair', 'weight'] },
      oracle_removed: { fields: ['oracle'] },
    },
  },
  {
    name: 'Governance',
    envVar: 'GOVERNANCE_CONTRACT_ID',
    events: {
      proposal_created: { fields: ['proposalId', 'proposer', 'title'] },
      vote_cast: { fields: ['proposalId', 'voter', 'choice', 'weight'] },
      proposal_passed: { fields: ['proposalId', 'result'] },
      proposal_rejected: { fields: ['proposalId', 'result'] },
      proposal_executed: { fields: ['proposalId', 'proposalType'] },
      proposal_cancelled: { fields: ['proposalId'] },
    },
  },
  {
    name: 'ImpactNFT',
    envVar: 'IMPACT_NFT_CONTRACT_ID',
    events: {
      badge_issued: { fields: ['badgeId', 'owner', 'definitionId'] },
    },
  },
];

/** A contract spec bound to its deployed id. */
export interface ContractBinding {
  readonly name: string;
  readonly contractId: string;
  readonly events: Readonly<Record<string, ContractEventSpec>>;
}

/**
 * A decoded, JSON-serialisable on-chain event.
 *
 * All values are JSON-safe: ledger integers are `number`, and every `i128`/`u64`
 * amount is a decimal **string**, because these events are handed to BullMQ
 * (JSON) and `JSON.stringify` throws on `BigInt`.
 */
export interface ParsedEvent {
  /** Soroban event id — unique on chain, used for idempotency. */
  eventId: string;
  contractName: string;
  eventName: string;
  contractId: string;
  ledgerSequence: number;
  /** Ledger close time as Unix seconds. */
  timestamp: number;
  /** Ledger close time, ISO-8601. */
  ledgerClosedAt: string;
  txHash: string;
  /**
   * `false` when the contract emitted an event this catalogue does not know
   * about. Unknown events are still recorded so a contract upgrade that adds an
   * event is visible rather than silent.
   */
  known: boolean;
  /** Field names for {@link data}, in order. */
  fieldNames: readonly string[];
  /** Decoded data tuple, keyed by {@link fieldNames}. */
  data: Record<string, unknown>;
  /** Every decoded topic, `topics[0]` being the event name. */
  topics: unknown[];
}

/** Raised when a raw RPC event record cannot be decoded. */
export class EventDecodeError extends Error {
  readonly recordId: string;

  constructor(recordId: string, message: string, cause?: unknown) {
    super(`Failed to decode Soroban event ${recordId}: ${message}`, { cause });
    this.name = 'EventDecodeError';
    this.recordId = recordId;
  }
}

/**
 * Recursively convert a decoded `ScVal` into JSON-safe values.
 *
 * `scValToNative` returns `bigint` for `u64`/`i64`/`i128`/`u128` and
 * `Uint8Array` for `bytes`; neither survives `JSON.stringify` intact.
 */
function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toJsonSafe(nested);
    }
    return out;
  }
  return value;
}

/** Decode a single base64 XDR `ScVal`. */
export function decodeScVal(base64: string): unknown {
  return scValToNative(xdr.ScVal.fromXdr(base64, 'base64'));
}

/** Bind the catalogue to the deployed contract ids in `env`. */
export function resolveContracts(env: NodeJS.ProcessEnv = process.env): ContractBinding[] {
  return CONTRACT_SPECS.map((spec) => ({
    name: spec.name,
    contractId: env[spec.envVar] ?? '',
    events: spec.events,
  }));
}

/** Deployed contract ids the indexer should subscribe to. */
export function getContractIds(env: NodeJS.ProcessEnv = process.env): string[] {
  return resolveContracts(env)
    .map((binding) => binding.contractId)
    .filter((id) => id.length > 0);
}

/**
 * Decode a Soroban RPC event record.
 *
 * Returns `null` when the record is not one the indexer should act on — a
 * different contract, a diagnostic/system event, or an event emitted by a call
 * that failed and was rolled back.
 *
 * @throws {EventDecodeError} when the record belongs to a watched contract but
 * its XDR cannot be decoded. Callers must record the failure and continue: one
 * malformed event must not stall the whole ledger.
 */
export function parseEventRecord(
  record: SorobanEventRecord,
  bindings: readonly ContractBinding[],
): ParsedEvent | null {
  if (record.type !== 'contract') return null;
  // A failed contract call rolls its events back; indexing them would fabricate
  // state changes that never happened.
  if (!record.inSuccessfulContractCall) return null;

  const binding = bindings.find((b) => b.contractId === record.contractId);
  if (!binding) return null;

  if (record.topic.length === 0) {
    throw new EventDecodeError(record.id, 'event has no topics');
  }

  let topics: unknown[];
  try {
    topics = record.topic.map(decodeScVal);
  } catch (error) {
    throw new EventDecodeError(record.id, 'undecodable topic XDR', error);
  }

  const eventName = topics[0];
  if (typeof eventName !== 'string' || eventName.length === 0) {
    throw new EventDecodeError(
      record.id,
      `expected the first topic to be a symbol, got ${typeof eventName}`,
    );
  }

  let payload: unknown;
  try {
    payload = toJsonSafe(decodeScVal(record.value));
  } catch (error) {
    throw new EventDecodeError(record.id, 'undecodable value XDR', error);
  }

  const spec = binding.events[eventName];
  const known = spec !== undefined;

  // Soroban publishes a tuple as an `ScVec`; a single-element publish may arrive
  // either as a one-element vec or as the bare value, so both are accepted.
  const args: unknown[] = Array.isArray(payload) ? payload : [payload];

  const fieldNames = known ? spec.fields : args.map((_, index) => `arg${String(index)}`);

  if (known && spec.fields.length !== args.length) {
    throw new EventDecodeError(
      record.id,
      `${eventName} expected ${String(spec.fields.length)} values (${spec.fields.join(', ')}), got ${String(args.length)}`,
    );
  }

  const data: Record<string, unknown> = {};
  fieldNames.forEach((field, index) => {
    data[field] = args[index];
  });

  const closedAt = Date.parse(record.ledgerClosedAt);
  if (Number.isNaN(closedAt)) {
    throw new EventDecodeError(record.id, `unparseable ledgerClosedAt: ${record.ledgerClosedAt}`);
  }

  return {
    eventId: record.id,
    contractName: binding.name,
    eventName,
    contractId: record.contractId,
    ledgerSequence: record.ledger,
    timestamp: Math.floor(closedAt / 1000),
    ledgerClosedAt: new Date(closedAt).toISOString(),
    txHash: record.txHash,
    known,
    fieldNames,
    data,
    topics,
  };
}
