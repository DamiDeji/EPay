import { StellarNetwork } from '@epay/types';
import { describe, it, expect } from 'vitest';

import {
  EPayError,
  calculateFee,
  calculateNetAmount,
  formatStellarAddress,
  getExplorerUrl,
  isValidStellarPublicKey,
  stroopsToXlm,
  xlmToStroops,
} from '../utils';

describe('stroopsToXlm', () => {
  it('should convert 1 XLM (10^7 stroops) to "1"', () => {
    expect(stroopsToXlm('10000000')).toBe('1');
  });

  it('should convert fractional amounts correctly', () => {
    expect(stroopsToXlm('15000000')).toBe('1.5');
  });

  it('should handle small amounts', () => {
    expect(stroopsToXlm('1')).toBe('0.0000001');
  });

  it('should handle zero', () => {
    expect(stroopsToXlm('0')).toBe('0');
  });

  it('should handle large amounts', () => {
    expect(stroopsToXlm('1000000000000000')).toBe('100000000');
  });
});

describe('xlmToStroops', () => {
  it('should convert "1" to 10000000 stroops', () => {
    expect(xlmToStroops('1')).toBe('10000000');
  });

  it('should convert fractional XLM', () => {
    expect(xlmToStroops('1.5')).toBe('15000000');
  });

  it('should handle zero', () => {
    expect(xlmToStroops('0')).toBe('0');
  });

  it('should handle small fractions', () => {
    expect(xlmToStroops('0.0000001')).toBe('1');
  });

  it('should round trip', () => {
    const original = '123.456789';
    expect(stroopsToXlm(xlmToStroops(original))).toBe('123.456789');
  });
});

describe('isValidStellarPublicKey', () => {
  it('should accept valid G... address', () => {
    expect(isValidStellarPublicKey('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe(true);
  });

  it('should reject short addresses', () => {
    expect(isValidStellarPublicKey('G_short')).toBe(false);
  });

  it('should reject non-Stellar addresses', () => {
    expect(isValidStellarPublicKey('0x1234567890abcdef')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidStellarPublicKey('')).toBe(false);
  });
});

describe('formatStellarAddress', () => {
  it('should truncate Stellar address', () => {
    const addr = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    expect(formatStellarAddress(addr)).toBe('GAAAAAAA...AAAA');
  });

  it('should use custom prefix/suffix', () => {
    const addr = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    expect(formatStellarAddress(addr, 12, 6)).toBe('GAAAAAAAAAAA...AAAAAA');
  });

  it('should return short address as-is', () => {
    expect(formatStellarAddress('short')).toBe('short');
  });
});

describe('getExplorerUrl', () => {
  it('should return testnet tx URL', () => {
    const url = getExplorerUrl('tx', '0xabc123', StellarNetwork.TESTNET);
    expect(url).toContain('stellar.expert');
    expect(url).toContain('testnet');
    expect(url).toContain('0xabc123');
  });

  it('should return public account URL', () => {
    const url = getExplorerUrl('account', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', StellarNetwork.PUBLIC);
    expect(url).toContain('stellar.expert');
    expect(url).toContain('public');
    expect(url).toContain('GAAAAAA');
  });

  it('should default to testnet', () => {
    const url = getExplorerUrl('tx', '0xhash');
    expect(url).toContain('testnet');
  });
});

describe('calculateFee', () => {
  it('should calculate 0.5% fee', () => {
    expect(calculateFee('10000000')).toBe('50000');
  });

  it('should calculate custom fee rate', () => {
    expect(calculateFee('10000000', 100)).toBe('100000'); // 1%
  });

  it('should handle zero amount', () => {
    expect(calculateFee('0')).toBe('0');
  });
});

describe('calculateNetAmount', () => {
  it('should deduct fee from amount', () => {
    expect(calculateNetAmount('10000000')).toBe('9950000');
  });
});

describe('EPayError', () => {
  it('should create from response', () => {
    const err = EPayError.fromResponse(400, { message: 'Bad request', errors: [{ code: 'E1', message: 'details' }] });
    expect(err.message).toBe('Bad request');
    expect(err.statusCode).toBe(400);
    expect(err.errors).toHaveLength(1);
    expect(err.name).toBe('EPayError');
  });

  it('should use default message when none provided', () => {
    const err = EPayError.fromResponse(500, {});
    expect(err.message).toBe('EPay API error: 500');
  });
});
