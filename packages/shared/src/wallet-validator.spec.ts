import { describe, expect, it } from 'vitest';

import {
  STELLAR_PUBLIC_KEY_LENGTH,
  isValidStellarAddress,
  looksLikeStellarAddress,
} from './wallet-validator';

/**
 * Shared fixtures.
 *
 * Address *shape* is all these helpers can verify — Stellar strkey checksums are
 * not validated here. The fixtures are therefore built from the real base32
 * alphabet (A-Z, 2-7) so the assertions describe the documented contract rather
 * than an accident of a particular string.
 *
 * Deliberately NOT used here: the hardcoded "testnet address" this module used to
 * return from `generateTestAddress()`. It contained a `0`, which is not in the
 * base32 alphabet, so the module's own validator rejected the address it
 * generated. That function has been removed.
 */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const G_ADDRESS = `G${BASE32[0].repeat(STELLAR_PUBLIC_KEY_LENGTH - 1)}`;
const M_ADDRESS = `M${BASE32[0].repeat(STELLAR_PUBLIC_KEY_LENGTH)}`;

describe('wallet-validator fixtures', () => {
  it('are the documented lengths', () => {
    expect(G_ADDRESS).toHaveLength(56);
    expect(M_ADDRESS).toHaveLength(57);
    expect(STELLAR_PUBLIC_KEY_LENGTH).toBe(56);
  });
});

describe('isValidStellarAddress', () => {
  it('accepts a G-address', () => {
    expect(isValidStellarAddress(G_ADDRESS)).toBe(true);
  });

  it('accepts an M-muxed account, which isValidStellarPublicKey does not', () => {
    expect(isValidStellarAddress(M_ADDRESS)).toBe(true);
  });

  it('rejects an address one character too short', () => {
    expect(isValidStellarAddress(G_ADDRESS.slice(0, -1))).toBe(false);
  });

  it('rejects an address one character too long', () => {
    expect(isValidStellarAddress(`${G_ADDRESS}A`)).toBe(false);
  });

  it('rejects a lowercase address (base32 is case-sensitive uppercase here)', () => {
    expect(isValidStellarAddress(G_ADDRESS.toLowerCase())).toBe(false);
  });

  it('rejects characters outside the base32 alphabet', () => {
    // 0, 1, 8 and 9 are not part of Stellar's base32 alphabet.
    for (const bad of ['0', '1', '8', '9']) {
      expect(isValidStellarAddress(`G${bad}${G_ADDRESS.slice(2)}`)).toBe(false);
    }
  });

  it('rejects prefixes other than G and M', () => {
    expect(isValidStellarAddress(`S${G_ADDRESS.slice(1)}`)).toBe(false);
    expect(isValidStellarAddress(`C${G_ADDRESS.slice(1)}`)).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isValidStellarAddress('')).toBe(false);
  });

  it('rejects non-string input without throwing', () => {
    for (const value of [null, undefined, 42, {}, []]) {
      expect(isValidStellarAddress(value as string)).toBe(false);
    }
  });
});

describe('looksLikeStellarAddress', () => {
  it('accepts a G-address', () => {
    expect(looksLikeStellarAddress(G_ADDRESS)).toBe(true);
  });

  it('trims surrounding whitespace before measuring', () => {
    expect(looksLikeStellarAddress(`  ${G_ADDRESS}\n`)).toBe(true);
  });

  it('rejects an M-address — it is the G-address-only UI check', () => {
    expect(looksLikeStellarAddress(M_ADDRESS)).toBe(false);
  });

  it('rejects a value of the wrong length even when it starts with G', () => {
    expect(looksLikeStellarAddress(`G${'A'.repeat(53)}`)).toBe(false);
    expect(looksLikeStellarAddress(`G${'A'.repeat(56)}`)).toBe(false);
  });

  it('rejects a 56-character value that does not start with G', () => {
    expect(looksLikeStellarAddress(`S${'A'.repeat(55)}`)).toBe(false);
  });

  it('rejects non-string input without throwing', () => {
    for (const value of [null, undefined, 42, {}]) {
      expect(looksLikeStellarAddress(value as string)).toBe(false);
    }
  });
});
