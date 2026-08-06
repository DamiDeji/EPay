import { StellarNetwork } from '@epay/types';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WalletClient } from '../wallet';

describe('WalletClient', () => {
  let wallet: WalletClient;

  beforeEach(() => {
    wallet = new WalletClient({ network: StellarNetwork.TESTNET });
  });

  describe('generateAuthMessage', () => {
    it('should generate a message with publicKey and nonce', () => {
      const msg = wallet.generateAuthMessage('GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234');
      expect(msg).toContain('EPay Authentication');
      expect(msg).toContain('GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234');
      expect(msg).toContain('Nonce:');
      expect(msg).toContain('Network: testnet');
    });
  });

  describe('buildWalletAuth', () => {
    it('should build a valid WalletAuth payload', () => {
      const result = wallet.buildWalletAuth({
        publicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
        signature: '0xsignature',
        message: 'test message',
        provider: 'freighter',
      });

      expect(result.publicKey).toBe('GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234');
      expect(result.signature).toBe('0xsignature');
      expect(result.network).toBe('testnet');
      expect(result.walletProvider).toBe('freighter');
    });

    it('should throw on invalid public key', () => {
      expect(() =>
        wallet.buildWalletAuth({
          publicKey: 'bad_key',
          signature: 'sig',
          message: 'msg',
          provider: 'freighter',
        }),
      ).toThrow('Invalid Stellar public key');
    });
  });

  describe('validatePublicKey', () => {
    it('should return true for valid Stellar public key', () => {
      expect(wallet.validatePublicKey('GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234')).toBe(true);
    });

    it('should return false for invalid public key', () => {
      expect(wallet.validatePublicKey('bad')).toBe(false);
    });
  });

  describe('getBalance', () => {
    it('should fetch balances from Horizon', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          balances: [{ asset_type: 'native', balance: '500.0000000' }],
        }),
      });
      globalThis.fetch = mockFetch as any;

      const balances = await wallet.getBalance('GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234');
      expect(balances).toHaveLength(1);
      expect(balances[0].assetCode).toBe('XLM');
      expect(balances[0].balance).toBe('500.0000000');
    });

    it('should throw on Horizon error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });
      globalThis.fetch = mockFetch as any;

      await expect(wallet.getBalance('GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234')).rejects.toThrow('Horizon API error');
    });
  });

  describe('accountExists', () => {
    it('should return true for existing account', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = mockFetch as any;

      const exists = await wallet.accountExists('GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing account', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      globalThis.fetch = mockFetch as any;

      const exists = await wallet.accountExists('GXXXXX1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234');
      expect(exists).toBe(false);
    });
  });
});
