import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletClient } from '../wallet';
import { TONNetwork } from '@epay/types';

describe('WalletClient', () => {
  let wallet: WalletClient;

  beforeEach(() => {
    wallet = new WalletClient({ network: TONNetwork.TESTNET });
  });

  describe('generateAuthMessage', () => {
    it('should generate a message with address and nonce', () => {
      const msg = wallet.generateAuthMessage('EQD_test_wallet');
      expect(msg).toContain('EPay Authentication');
      expect(msg).toContain('EQD_test_wallet');
      expect(msg).toContain('Nonce:');
      expect(msg).toContain('Network: testnet');
    });
  });

  describe('buildWalletAuth', () => {
    it('should build a valid WalletAuth payload', () => {
      const result = wallet.buildWalletAuth({
        address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU',
        publicKey: 'pub_key_123',
        signature: '0xsignature',
        message: 'test message',
      });

      expect(result.address).toBe('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU');
      expect(result.publicKey).toBe('pub_key_123');
      expect(result.network).toBe('testnet');
    });

    it('should throw on invalid address', () => {
      expect(() =>
        wallet.buildWalletAuth({
          address: 'bad_address',
          publicKey: 'pk',
          signature: 'sig',
          message: 'msg',
        }),
      ).toThrow('Invalid TON address');
    });
  });

  describe('validateAddress', () => {
    it('should return true for valid TON address', () => {
      expect(wallet.validateAddress('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU')).toBe(true);
    });

    it('should return false for invalid address', () => {
      expect(wallet.validateAddress('bad')).toBe(false);
    });
  });

  describe('getBalance', () => {
    it('should fetch balance from RPC', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ result: { balance: '5000000000' } }),
      });
      globalThis.fetch = mockFetch as any;

      const balance = await wallet.getBalance('EQD_test');
      expect(balance).toBe('5000000000');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on RPC error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ error: { code: -1, message: 'RPC error' } }),
      });
      globalThis.fetch = mockFetch as any;

      await expect(wallet.getBalance('EQD_test')).rejects.toThrow('TON RPC error');
    });

    it('should return "0" if balance is missing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ result: {} }),
      });
      globalThis.fetch = mockFetch as any;

      const balance = await wallet.getBalance('EQD_test');
      expect(balance).toBe('0');
    });
  });
});
