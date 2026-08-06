// EPay Shared Utilities — Stellar Network
// ============================================================================

import { STELLAR_DECIMALS } from '@epay/config';
import type { StellarNetwork } from '@epay/types';

// ── API Response Helpers ────────────────────────────────────────────────────

export function successResponse<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(message: string, errors?: { code: string; message: string; field?: string }[]) {
  return {
    success: false,
    data: null,
    message,
    errors,
    timestamp: new Date().toISOString(),
  };
}

// ── ID Generation ───────────────────────────────────────────────────────────

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'epay_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// ── Stellar Unit Conversion ─────────────────────────────────────────────────

/**
 * Convert stroops (smallest Stellar unit) to human-readable XLM.
 * 1 XLM = 10^7 stroops
 */
export function stroopsToXlm(stroops: string): string {
  const value = BigInt(stroops);
  const whole = value / BigInt(10 ** STELLAR_DECIMALS);
  const fraction = value % BigInt(10 ** STELLAR_DECIMALS);
  const fracStr = fraction.toString().padStart(STELLAR_DECIMALS, '0').replace(/0+$/, '');
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

/**
 * Convert human-readable XLM to stroops string.
 */
export function xlmToStroops(xlm: string): string {
  const [whole = '0', fraction = '0'] = xlm.split('.');
  const padded = fraction.padEnd(STELLAR_DECIMALS, '0').slice(0, STELLAR_DECIMALS);
  return (BigInt(whole) * BigInt(10 ** STELLAR_DECIMALS) + BigInt(padded)).toString();
}

/**
 * Format any Stellar asset amount for display.
 */
export function formatAssetAmount(amount: string, decimals = STELLAR_DECIMALS): string {
  const value = BigInt(amount);
  const whole = value / BigInt(10 ** decimals);
  const fraction = value % BigInt(10 ** decimals);
  const fracStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

// ── Stellar Address Validation ──────────────────────────────────────────────

/**
 * Validate a Stellar public key (G... address).
 */
export function isValidStellarPublicKey(key: string): boolean {
  if (typeof key !== 'string' || key.length !== 56) return false;
  return /^G[A-Z2-7]{55}$/.test(key);
}

/**
 * Validate a Stellar secret key (S...).
 */
export function isValidStellarSecretKey(key: string): boolean {
  if (typeof key !== 'string' || key.length !== 56) return false;
  return /^S[A-Z2-7]{55}$/.test(key);
}

/**
 * Validate a Soroban contract ID (C...).
 */
export function isValidContractId(id: string): boolean {
  if (typeof id !== 'string' || id.length !== 56) return false;
  return /^C[A-Z2-7]{55}$/.test(id);
}

/**
 * Truncate a Stellar address for display.
 */
export function formatStellarAddress(address: string, prefix = 8, suffix = 4): string {
  if (address.length <= prefix + suffix + 3) return address;
  return `${address.slice(0, prefix)}...${address.slice(-suffix)}`;
}

// ── Explorer URLs ───────────────────────────────────────────────────────────

/**
 * Get the Stellar explorer URL for a transaction, account, or ledger.
 */
export function getExplorerUrl(
  type: 'tx' | 'account' | 'ledger' | 'contract',
  value: string,
  network: StellarNetwork = 'testnet' as StellarNetwork,
): string {
  const base = network === ('public' as StellarNetwork)
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';

  switch (type) {
    case 'tx': return `${base}/tx/${value}`;
    case 'account': return `${base}/account/${value}`;
    case 'ledger': return `${base}/ledger/${value}`;
    case 'contract': return `${base}/contract/${value}`;
    default: return base;
  }
}

// ── Fee Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate EPay fee for a given amount in stroops.
 * @param amountStroops - Amount in stroops as string
 * @param feeBps - Fee in basis points (default 50 = 0.5%)
 */
export function calculateFee(amountStroops: string, feeBps = 50): string {
  return ((BigInt(amountStroops) * BigInt(feeBps)) / BigInt(10000)).toString();
}

/**
 * Calculate net amount after deducting fee.
 */
export function calculateNetAmount(amountStroops: string, feeBps = 50): string {
  const fee = calculateFee(amountStroops, feeBps);
  return (BigInt(amountStroops) - BigInt(fee)).toString();
}

/**
 * Calculate the minimum Stellar account balance including reserves.
 */
export function calculateMinBalance(
  numTrustlines = 0,
  numOffers = 0,
  numSigners = 0,
): string {
  const baseReserve = BigInt('10000000'); // 1 XLM
  const trustlineReserve = BigInt('5000000'); // 0.5 XLM per trustline
  const offerReserve = BigInt('5000000'); // 0.5 XLM per offer
  const signerReserve = BigInt('5000000'); // 0.5 XLM per signer

  let total = BigInt(2) * baseReserve;
  total += BigInt(numTrustlines) * trustlineReserve;
  total += BigInt(numOffers) * offerReserve;
  total += BigInt(numSigners) * signerReserve;

  return total.toString();
}

// ── Memo Helpers ────────────────────────────────────────────────────────────

export function createMemoText(text: string): { type: 'text'; value: string } {
  return { type: 'text', value: text.slice(0, 28) };
}

export function createMemoId(id: string): { type: 'id'; value: string } {
  return { type: 'id', value: id };
}

export function createMemoHash(hash: string): { type: 'hash'; value: string } {
  return { type: 'hash', value: hash };
}

// ── Misc Utilities ──────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { data: T[]; total: number; page: number; pageSize: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Error Class ─────────────────────────────────────────────────────────────

export class EPayError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors?: { code: string; message: string; field?: string }[],
  ) {
    super(message);
    this.name = 'EPayError';
  }

  static fromResponse(status: number, body: Record<string, unknown>): EPayError {
    const message = (body.message as string | undefined) ?? `EPay API error: ${String(status)}`;
    const errors = body.errors as { code: string; message: string; field?: string }[] | undefined;
    return new EPayError(message, status, errors);
  }
}
