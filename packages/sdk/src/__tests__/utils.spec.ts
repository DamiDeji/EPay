import { describe, it, expect } from 'vitest';
import {
  nanoToTon,
  tonToNano,
  isValidTonAddress,
  formatAddress,
  getExplorerUrl,
  calculateFee,
  calculateNetAmount,
  EPayError,
} from '../utils';
import { TONNetwork } from '@epay/types';

describe('nanoToTon', () => {
  it('should convert 1 TON (10^9 nanoTON) to "1"', () => {
    expect(nanoToTon('1000000000')).toBe('1');
  });

  it('should convert fractional amounts correctly', () => {
    expect(nanoToTon('1500000000')).toBe('1.5');
  });

  it('should handle small amounts', () => {
    expect(nanoToTon('1')).toBe('0.000000001');
  });

  it('should handle zero', () => {
    expect(nanoToTon('0')).toBe('0');
  });

  it('should handle large amounts', () => {
    expect(nanoToTon('1000000000000000')).toBe('1000000');
  });
});

describe('tonToNano', () => {
  it('should convert "1" to 1000000000 nanoTON', () => {
    expect(tonToNano('1')).toBe('1000000000');
  });

  it('should convert fractional TON', () => {
    expect(tonToNano('1.5')).toBe('1500000000');
  });

  it('should handle zero', () => {
    expect(tonToNano('0')).toBe('0');
  });

  it('should handle small fractions', () => {
    expect(tonToNano('0.000000001')).toBe('1');
  });

  it('should round trip', () => {
    const original = '123.456789';
    expect(nanoToTon(tonToNano(original))).toBe('123.456789');
  });
});

describe('isValidTonAddress', () => {
  it('should accept valid EQ address', () => {
    expect(isValidTonAddress('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU')).toBe(true);
  });

  it('should accept valid UQ address', () => {
    expect(isValidTonAddress('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU')).toBe(true);
  });

  it('should reject short addresses', () => {
    expect(isValidTonAddress('EQ_short')).toBe(false);
  });

  it('should reject non-TON addresses', () => {
    expect(isValidTonAddress('0x1234567890abcdef')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidTonAddress('')).toBe(false);
  });
});

describe('formatAddress', () => {
  it('should truncate TON address', () => {
    const addr = 'EQD2kR1pBx9Yp8mQwL_fVn3XyZ5aBcDeFgHiJkLmNoPqRsTu';
    expect(formatAddress(addr)).toBe('EQD2kR...RsTu');
  });

  it('should use custom prefix/suffix', () => {
    const addr = 'EQD2kR1pBx9Yp8mQwL_fVn3XyZ5aBcDeFgHiJkLmNoPqRsTu';
    expect(formatAddress(addr, 8, 6)).toBe('EQD2kR1p...PqRsTu');
  });

  it('should return short address as-is', () => {
    expect(formatAddress('short')).toBe('short');
  });
});

describe('getExplorerUrl', () => {
  it('should return testnet tx URL', () => {
    const url = getExplorerUrl('tx', '0xabc123', TONNetwork.TESTNET);
    expect(url).toContain('testnet.tonscan.org');
    expect(url).toContain('0xabc123');
  });

  it('should return mainnet address URL', () => {
    const url = getExplorerUrl('address', 'EQD_test', TONNetwork.MAINNET);
    expect(url).toContain('tonscan.org');
    expect(url).toContain('EQD_test');
  });

  it('should default to testnet', () => {
    const url = getExplorerUrl('tx', '0xhash');
    expect(url).toContain('testnet');
  });
});

describe('calculateFee', () => {
  it('should calculate 0.5% fee', () => {
    expect(calculateFee('1000000000')).toBe('5000000');
  });

  it('should calculate custom fee rate', () => {
    expect(calculateFee('1000000000', 100)).toBe('10000000'); // 1%
  });

  it('should handle zero amount', () => {
    expect(calculateFee('0')).toBe('0');
  });
});

describe('calculateNetAmount', () => {
  it('should deduct fee from amount', () => {
    expect(calculateNetAmount('1000000000')).toBe('995000000');
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
