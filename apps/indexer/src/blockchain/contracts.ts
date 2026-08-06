/**
 * EPay Soroban smart contract IDs and event definitions.
 *
 * Contract IDs are loaded from environment variables or deployment manifest.
 * Events are filtered from Soroban diagnostic events on Stellar.
 */

export interface ContractInfo {
  name: string;
  contractId: string;
  events: string[];
}

export interface ParsedEvent {
  contractName: string;
  eventName: string;
  ledgerSequence: number;
  txHash: string;
  timestamp: number;
  sourceAccount: string;
  contractId: string;
  data: Record<string, unknown>;
}

/**
 * Known EPay Soroban contracts.
 */
export const CONTRACTS: Record<string, ContractInfo> = {
  PaymentRouter: {
    name: 'PaymentRouter',
    contractId: process.env.PAYMENT_ROUTER_CONTRACT_ID ?? '',
    events: ['payment_created', 'payment_confirmed', 'payment_completed', 'payment_failed', 'payment_refunded'],
  },
  InvoiceManager: {
    name: 'InvoiceManager',
    contractId: process.env.INVOICE_MANAGER_CONTRACT_ID ?? '',
    events: ['invoice_created', 'invoice_issued', 'invoice_paid', 'invoice_cancelled', 'invoice_refunded'],
  },
  EscrowManager: {
    name: 'EscrowManager',
    contractId: process.env.ESCROW_MANAGER_CONTRACT_ID ?? '',
    events: ['escrow_created', 'escrow_funded', 'milestone_done', 'milestone_rel', 'escrow_completed', 'escrow_disputed', 'escrow_resolved', 'escrow_cancelled'],
  },
  RefundManager: {
    name: 'RefundManager',
    contractId: process.env.REFUND_MANAGER_CONTRACT_ID ?? '',
    events: ['refund_requested', 'refund_approved', 'refund_completed', 'refund_rejected'],
  },
  SubscriptionManager: {
    name: 'SubscriptionManager',
    contractId: process.env.SUBSCRIPTION_MANAGER_CONTRACT_ID ?? '',
    events: ['sub_created', 'sub_renewed', 'sub_paused', 'sub_cancelled'],
  },
  TreasuryVault: {
    name: 'TreasuryVault',
    contractId: process.env.TREASURY_VAULT_CONTRACT_ID ?? '',
    events: ['treasury_deposit', 'treasury_withdraw'],
  },
  MerchantRegistry: {
    name: 'MerchantRegistry',
    contractId: process.env.MERCHANT_REGISTRY_CONTRACT_ID ?? '',
    events: ['merchant_reg', 'merchant_verified', 'merchant_suspended'],
  },
};

/**
 * Get all contract IDs that the indexer should monitor.
 */
export function getContractIds(): string[] {
  return Object.values(CONTRACTS)
    .map((c) => c.contractId)
    .filter((id) => id.length > 0);
}

/**
 * Parse a Soroban diagnostic event into a structured event.
 *
 * In production, this decodes Soroban event topics and data
 * from Horizon transaction responses.
 */
export function parseEvent(
  contractId: string,
  txHash: string,
  ledgerSequence: number,
  timestamp: number,
  sourceAccount: string,
  eventTopics: string[],
  eventData: Record<string, unknown>,
): ParsedEvent | null {
  const contract = Object.values(CONTRACTS).find((c) => c.contractId === contractId);
  if (!contract) return null;

  const eventName = eventTopics.length > 0 ? eventTopics[0] : 'unknown';

  return {
    contractName: contract.name,
    eventName,
    ledgerSequence,
    txHash,
    timestamp,
    sourceAccount,
    contractId,
    data: eventData,
  };
}
