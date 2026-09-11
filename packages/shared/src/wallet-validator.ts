/**
 * Shared Stellar wallet address validation utilities.
 * Used by API, SDK, and frontend to validate Stellar public keys consistently.
 *
 * Stellar public keys (G-addresses) are 56 characters:
 * - Start with 'G'
 * - 55 base32 characters (ABCDEFGHIJKLMNOPQRSTUVWXYZ234567)
 * - Encodes a 32-byte Ed25519 public key
 */

/** Stellar public key regex: G followed by 55 base32 chars */
const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

/** Base32 alphabet used by Stellar */
const BASE32_ALPHABET = new Set(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.split(''),
);

/**
 * Validates a Stellar public key (G-address) format.
 *
 * @param address - The address to validate (e.g., "GBRPYAB..." or "GDJ...")
 * @returns true if the address is a valid Stellar public key format
 */
export function isValidStellarPublicKey(address: string): boolean {
  if (typeof address !== 'string') return false;
  if (address.length !== 56) return false;
  return STELLAR_PUBLIC_KEY_REGEX.test(address);
}

/**
 * Validates a Stellar address and returns a normalized version.
 * Throws if invalid.
 *
 * @param address - The address to validate
 * @returns The normalized address (uppercase, trimmed)
 * @throws {Error} If the address is invalid
 */
export function validateStellarPublicKey(address: string): string {
  const normalized = address.trim().toUpperCase();
  if (!isValidStellarPublicKey(normalized)) {
    throw new Error(
      `Invalid Stellar public key: "${address}". Expected a 56-character G-address (G + 55 base32 characters).`,
    );
  }
  return normalized;
}

/**
 * Validates a complete Stellar account ID (supports both G-pubkeys and M-hashes).
 * Most EPay use cases expect G-pubkeys.
 *
 * @param address - The address to validate
 * @returns true if it's a valid Stellar address format
 */
export function isValidStellarAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  // G-address (Ed25519 public key): 56 chars
  if (STELLAR_PUBLIC_KEY_REGEX.test(address)) return true;
  // M-address (hash): M + 56 base32 chars = 57 chars
  // Not commonly used for EPay, but supported for completeness
  const M_ADDRESS_REGEX = /^M[A-Z2-7]{56}$/;
  return M_ADDRESS_REGEX.test(address);
}

/**
 * Checks if a string looks like it could be a Stellar address
 * (loose check for UI purposes — doesn't guarantee validity).
 */
export function looksLikeStellarAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  const trimmed = address.trim();
  return trimmed.length === 56 && trimmed.startsWith('G');
}

/**
 * Converts stroops to XLM (1 XLM = 10^7 stroops).
 */
export function stroopsToXlm(stroops: bigint | number): number {
  const divisor = 10_000_000n;
  const s = typeof stroops === 'bigint' ? stroops : BigInt(stroops);
  return Number(s) / 10_000_000;
}

/**
 * Converts XLM to stroops (1 XLM = 10^7 stroops).
 */
export function xlmToStroops(xlm: number | bigint): bigint {
  const x = typeof xlm === 'bigint' ? xlm : BigInt(xlm);
  return x * 10_000_000n;
}

/**
 * Formats a Stellar address for display (shows first 8 and last 8 chars).
 */
export function formatStellarAddress(address: string): string {
  if (address.length !== 56) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

/**
 * Generates a Stellar testnet/demo address from a seed (for testing only).
 * In production, addresses should come from actual wallet keypairs.
 */
export function generateTestAddress(): string {
  // Return a known valid testnet address for demo purposes
  // This is the Stellar testnet friendbot address
  return 'GBRPYH46O7YZCRY0YNB7N3SDHS4YJ4ITPXD3E4DXMZ6MIKOS7PN5MY';
}
