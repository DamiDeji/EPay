import type { StellarNetwork } from '@epay/types';

const STELLAR_DECIMALS = 7;

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
 * Validate a Stellar public key (G... address, 56 chars).
 */
export function isValidStellarPublicKey(key: string): boolean {
  if (typeof key !== 'string' || key.length !== 56) return false;
  return /^G[A-Z2-7]{55}$/.test(key);
}

/**
 * Validate a Stellar secret key (S... address, 56 chars).
 */
export function isValidStellarSecretKey(key: string): boolean {
  if (typeof key !== 'string' || key.length !== 56) return false;
  return /^S[A-Z2-7]{55}$/.test(key);
}

/**
 * Truncate a Stellar address for display.
 */
export function formatStellarAddress(address: string, prefix = 8, suffix = 4): string {
  if (address.length <= prefix + suffix + 3) return address;
  return `${address.slice(0, prefix)}...${address.slice(-suffix)}`;
}

/**
 * Get the Stellar explorer URL for a transaction, account, or ledger.
 */
export function getExplorerUrl(
  type: 'tx' | 'account' | 'ledger' | 'contract',
  value: string,
  network: StellarNetwork = 'testnet' as StellarNetwork,
): string {
  const base =
    network === ('public' as StellarNetwork)
      ? 'https://stellar.expert/explorer/public'
      : 'https://stellar.expert/explorer/testnet';

  switch (type) {
    case 'tx':
      return `${base}/tx/${value}`;
    case 'account':
      return `${base}/account/${value}`;
    case 'ledger':
      return `${base}/ledger/${value}`;
    case 'contract':
      return `${base}/contract/${value}`;
    default:
      return base;
  }
}

// ── Aliases for backward compatibility with shared package ──────────────────

export const nanoToTon = stroopsToXlm;
export const tonToNano = xlmToStroops;
export const isValidTonAddress = isValidStellarPublicKey;
export const formatAddress = formatStellarAddress;

/**
 * Calculate fee for a given amount in stroops.
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
 * Standard EPay API error.
 */
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
    const message =
      (body.message as string | undefined) ?? `EPay API error: ${String(status)}`;
    const errors = body.errors as { code: string; message: string; field?: string }[] | undefined;
    return new EPayError(message, status, errors);
  }
}
