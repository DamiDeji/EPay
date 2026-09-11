/**
 * Stellar account detection.
 *
 * A Stellar ed25519 public key is a 56-character StrKey beginning with `G`
 * encoded in RFC 4648 base32 (alphabet `A–Z` and `2–7`). We deliberately use
 * the same character class as `@epay/sdk`'s `isValidStellarPublicKey` so a page
 * never surfaces an address the SDK would later reject.
 *
 * This module has no DOM or browser-extension imports so it can be unit tested
 * under plain Vitest and reused by both the content script and the popup.
 */
export const STELLAR_ACCOUNT_PATTERN = 'G[A-Z2-7]{55}';

const ACCOUNT_REGEX = new RegExp(`\\b${STELLAR_ACCOUNT_PATTERN}\\b`, 'g');
const SINGLE_ACCOUNT_REGEX = new RegExp(`^${STELLAR_ACCOUNT_PATTERN}$`);

/** True when `value` is a syntactically valid Stellar public key. */
export function isStellarAccount(value: string): boolean {
  return SINGLE_ACCOUNT_REGEX.test(value);
}

/**
 * Find every distinct Stellar account in `text`, in first-seen order.
 * Results are upper-cased so `g...` in prose still resolves.
 */
export function findStellarAccounts(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.toUpperCase().matchAll(ACCOUNT_REGEX)) {
    found.add(match[0]);
  }
  return [...found];
}

/** Shorten an address for display: `GABCDE…WXYZ`. */
export function truncateAccount(account: string, lead = 6, tail = 4): string {
  if (account.length <= lead + tail) return account;
  return `${account.slice(0, lead)}…${account.slice(-tail)}`;
}

/**
 * Build a canonical `epay://pay` URI for a detected address, optionally
 * carrying an amount so the mobile/web client can prefill the payment form.
 */
export function buildPaymentUri(account: string, amount?: string, asset?: string): string {
  const params = new URLSearchParams({ to: account });
  if (amount) params.set('amount', amount);
  if (asset) params.set('asset', asset);
  return `epay://pay?${params.toString()}`;
}
