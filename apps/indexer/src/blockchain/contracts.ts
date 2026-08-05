/**
 * EPay smart contract addresses and event definitions.
 *
 * In production, contract addresses would be loaded from environment variables
 * or a deployment manifest. Event parsing would decode TON message bodies.
 */

export interface ContractInfo {
  name: string;
  address: string;
  events: string[];
}

export interface ParsedEvent {
  contractName: string;
  eventName: string;
  blockHeight: number;
  txHash: string;
  timestamp: number;
  sender: string;
  data: Record<string, unknown>;
}

/**
 * Known EPay contract addresses by name.
 */
export const CONTRACTS: Record<string, ContractInfo> = {
  PaymentRouter: {
    name: 'PaymentRouter',
    address: process.env.PAYMENT_ROUTER_ADDRESS ?? '',
    events: ['PaymentCreated', 'PaymentConfirmed', 'PaymentCompleted', 'PaymentFailed', 'PaymentRefunded'],
  },
  InvoiceManager: {
    name: 'InvoiceManager',
    address: process.env.INVOICE_MANAGER_ADDRESS ?? '',
    events: ['InvoiceCreated', 'InvoiceIssued', 'InvoicePaid', 'InvoiceCancelled', 'InvoiceRefunded'],
  },
  EscrowManager: {
    name: 'EscrowManager',
    address: process.env.ESCROW_MANAGER_ADDRESS ?? '',
    events: ['EscrowCreated', 'EscrowFunded', 'MilestoneCompleted', 'MilestoneReleased', 'EscrowCompleted', 'EscrowDisputed', 'EscrowResolved', 'EscrowCancelled'],
  },
  RefundManager: {
    name: 'RefundManager',
    address: process.env.REFUND_MANAGER_ADDRESS ?? '',
    events: ['RefundRequested', 'RefundApproved', 'RefundCompleted', 'RefundRejected'],
  },
  SubscriptionManager: {
    name: 'SubscriptionManager',
    address: process.env.SUBSCRIPTION_MANAGER_ADDRESS ?? '',
    events: ['SubscriptionCreated', 'SubscriptionRenewed', 'SubscriptionPaused', 'SubscriptionCancelled'],
  },
  TreasuryVault: {
    name: 'TreasuryVault',
    address: process.env.TREASURY_VAULT_ADDRESS ?? '',
    events: ['Deposit', 'Withdrawal', 'FeeCollected', 'EscrowHeld', 'EscrowReleased'],
  },
  MerchantRegistry: {
    name: 'MerchantRegistry',
    address: process.env.MERCHANT_REGISTRY_ADDRESS ?? '',
    events: ['MerchantRegistered', 'MerchantVerified', 'MerchantSuspended'],
  },
};

/**
 * Get all contract addresses that the indexer should monitor.
 */
export function getContractAddresses(): string[] {
  return Object.values(CONTRACTS)
    .map((c) => c.address)
    .filter((a) => a.length > 0);
}

/**
 * Parse a raw TON transaction message body into a structured event.
 *
 * In production, this would use @ton/core Cell parsing to decode
 * the message body according to the contract's ABI.
 */
export function parseEvent(
  contractAddress: string,
  txHash: string,
  blockHeight: number,
  timestamp: number,
  sender: string,
  _messageBody: string, // raw message body
): ParsedEvent | null {
  const contract = Object.values(CONTRACTS).find((c) => c.address === contractAddress);
  if (!contract) return null;

  // In production, decode the message body using contract ABI
  // For now, create a structured event with the raw data
  return {
    contractName: contract.name,
    eventName: 'Transaction', // would be parsed from message body
    blockHeight,
    txHash,
    timestamp,
    sender,
    data: {
      contractAddress,
      rawMessage: _messageBody,
      parsed: {},
    },
  };
}
