import { describe, expect, it } from 'vitest';

import { buildPaymentUri, findStellarAccounts, isStellarAccount, truncateAccount } from './detect';

// `G` followed by 55 base32 characters (RFC 4648 alphabet A–Z and 2–7).
const A = `G${'A'.repeat(55)}`;
const B = `G${'B'.repeat(55)}`;

describe('isStellarAccount', () => {
  it('accepts a valid account', () => {
    expect(isStellarAccount(A)).toBe(true);
  });

  it('rejects a 55-character key', () => {
    expect(isStellarAccount(A.slice(0, 55))).toBe(false);
  });

  it('rejects keys containing base32-invalid characters', () => {
    expect(isStellarAccount(`G${'0'.repeat(55)}`)).toBe(false);
  });

  it('rejects a secret key', () => {
    expect(isStellarAccount(`S${A.slice(1)}`)).toBe(false);
  });
});

describe('findStellarAccounts', () => {
  it('finds distinct accounts in first-seen order', () => {
    expect(findStellarAccounts(`Send to ${A} then ${B}, not ${A} again.`)).toEqual([A, B]);
  });

  it('uppercases lowercase prose before matching', () => {
    expect(findStellarAccounts(A.toLowerCase())).toEqual([A]);
  });

  it('returns nothing when there are no accounts', () => {
    expect(findStellarAccounts('no keys here')).toEqual([]);
  });

  it('does not match accounts embedded in a longer token', () => {
    expect(findStellarAccounts(`x${A}`)).toEqual([]);
  });
});

describe('truncateAccount', () => {
  it('shortens long addresses', () => {
    expect(truncateAccount(A)).toBe(`${A.slice(0, 6)}…${A.slice(-4)}`);
  });

  it('leaves short strings untouched', () => {
    expect(truncateAccount('GABC')).toBe('GABC');
  });
});

describe('buildPaymentUri', () => {
  it('encodes destination, amount, and asset', () => {
    expect(buildPaymentUri(A, '12.5', 'USDC')).toBe(`epay://pay?to=${A}&amount=12.5&asset=USDC`);
  });

  it('omits empty optional parameters', () => {
    expect(buildPaymentUri(A)).toBe(`epay://pay?to=${A}`);
  });
});
