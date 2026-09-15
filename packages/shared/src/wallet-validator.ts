/**
 * Shared Stellar address-shape helpers.
 *
 * These complement the validators declared in `./index.ts`:
 *   - `isValidStellarAddress` accepts *both* G-addresses (Ed25519 public keys)
 *     and M-addresses (muxed accounts), which `isValidStellarPublicKey` does not.
 *   - `looksLikeStellarAddress` is the deliberately loose check the UI uses while
 *     the user is still typing, before a full validation should be raised.
 *
 * Stellar G-addresses are 56 characters: 'G' followed by 55 base32 characters
 * (A-Z, 2-7). M-addresses are 57 characters: 'M' followed by 56 base32 characters.
 *
 * NOTE: the stroops/XLM conversion and `formatStellarAddress` helpers that used to
 * live in this file were removed — they duplicated `./index.ts` and, worse, did
 * money conversion through `Number` (float) arithmetic. `./index.ts` does the same
 * work on `bigint`, which is the only safe representation for stroops.
 */

/** Stellar public key regex: G followed by 55 base32 chars */
const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

/** Stellar muxed account regex: M followed by 56 base32 chars */
const STELLAR_MUXED_ACCOUNT_REGEX = /^M[A-Z2-7]{56}$/;

/** Length of a Stellar G-address. */
export const STELLAR_PUBLIC_KEY_LENGTH = 56;

/**
 * Validates a complete Stellar account ID (supports both G-pubkeys and M-muxed
 * accounts).
 *
 * Note that "format-valid" is not the same as "exists": a well-formed base32
 * string can still fail the strkey checksum, which only the network can confirm.
 *
 * @param address - The address to validate
 * @returns true if the address matches a supported Stellar address shape
 */
export function isValidStellarAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  return STELLAR_PUBLIC_KEY_REGEX.test(address) || STELLAR_MUXED_ACCOUNT_REGEX.test(address);
}

/**
 * Checks if a string looks like it could be a Stellar G-address.
 *
 * This is a loose check for UI purposes — it does not guarantee validity, and it
 * only recognises G-addresses, not M-addresses.
 *
 * @param address - The string to inspect
 * @returns true when the trimmed value is G-prefixed and 56 characters long
 */
export function looksLikeStellarAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  const trimmed = address.trim();
  return trimmed.length === STELLAR_PUBLIC_KEY_LENGTH && trimmed.startsWith('G');
}
