import { TONNetwork } from '@epay/types';
import type { ApiError } from '@epay/types';

const TON_DECIMALS = 9;

/**
 * Convert nanoTON (raw TON units as bigint string) to human-readable TON.
 */
export function nanoToTon(nanoTon: string): string {
  const value = BigInt(nanoTon);
  const whole = value / BigInt(10 ** TON_DECIMALS);
  const fraction = value % BigInt(10 ** TON_DECIMALS);
  const fracStr = fraction.toString().padStart(TON_DECIMALS, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/**
 * Convert human-readable TON to nanoTON string.
 */
export function tonToNano(ton: string): string {
  const [whole = '0', fraction = '0'] = ton.split('.');
  const padded = fraction.padEnd(TON_DECIMALS, '0').slice(0, TON_DECIMALS);
  return (BigInt(whole) * BigInt(10 ** TON_DECIMALS) + BigInt(padded)).toString();
}

/**
 * Validate a TON address format (basic checks).
 */
export function isValidTonAddress(address: string): boolean {
  if (typeof address !== 'string' || address.length < 48) return false;
  if (!address.startsWith('EQ') && !address.startsWith('UQ') && !address.startsWith('kQ') && !address.startsWith('Ef') && !address.startsWith('Uf')) {
    return false;
  }
  return /^[EUk][Qq][A-Za-z0-9_-]{46,}$/.test(address);
}

/**
 * Truncate a TON address for display.
 */
export function formatAddress(address: string, prefix = 6, suffix = 4): string {
  if (address.length <= prefix + suffix + 3) return address;
  return `${address.slice(0, prefix)}...${address.slice(-suffix)}`;
}

/**
 * Get the explorer URL for a transaction or address on the given network.
 */
export function getExplorerUrl(
  type: 'tx' | 'address',
  value: string,
  network: TONNetwork = TONNetwork.TESTNET,
): string {
  const base = network === 'mainnet' ? 'https://tonscan.org' : 'https://testnet.tonscan.org';
  return `${base}/${type}/${value}`;
}

/**
 * Calculate EPay fee for a given amount in nanoTON.
 * @param amountNano - Amount in nanoTON as string
 * @param feeBps - Fee in basis points (default 50 = 0.5%)
 */
export function calculateFee(amountNano: string, feeBps = 50): string {
  return ((BigInt(amountNano) * BigInt(feeBps)) / BigInt(10000)).toString();
}

/**
 * Calculate net amount after deducting fee.
 */
export function calculateNetAmount(amountNano: string, feeBps = 50): string {
  const fee = calculateFee(amountNano, feeBps);
  return (BigInt(amountNano) - BigInt(fee)).toString();
}

/**
 * Standard EPay API error shape for thrown errors.
 */
export class EPayError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors?: ApiError[],
  ) {
    super(message);
    this.name = 'EPayError';
  }

  static fromResponse(status: number, body: Record<string, unknown>): EPayError {
    const message = (body.message as string) ?? `EPay API error: ${status}`;
    const errors = body.errors as ApiError[] | undefined;
    return new EPayError(message, status, errors);
  }
}
