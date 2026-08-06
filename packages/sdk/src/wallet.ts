import type { StellarNetwork, WalletAuth, WalletProvider } from '@epay/types';
import { isValidStellarPublicKey } from './utils';

/**
 * Configuration for wallet authentication with a Stellar wallet.
 */
export interface WalletConfig {
  network: StellarNetwork;
  horizonUrl?: string;
  sorobanRpcUrl?: string;
}

/**
 * Result of a wallet signature request.
 */
export interface WalletSignature {
  publicKey: string;
  signature: string;
  message: string;
  provider: WalletProvider;
}

/**
 * High-level wallet integration utilities for connecting Stellar wallets
 * and signing authentication messages.
 *
 * Supports: Freighter, xBull, Albedo, Rabet, Lobstr
 *
 * In production, integrate directly with each wallet's browser extension API
 * to get real wallet signatures. This class provides a unified abstraction.
 */
export class WalletClient {
  readonly config: WalletConfig;

  constructor(config: WalletConfig) {
    this.config = {
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      ...config,
    };
  }

  /**
   * Generate an authentication message for a wallet to sign.
   * Creates a unique nonce-based message that proves wallet ownership.
   */
  generateAuthMessage(publicKey: string): string {
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const lines = [
      'EPay Authentication',
      `Prove you own the Stellar account: ${publicKey}`,
      '',
      `Nonce: ${nonce}`,
      `Timestamp: ${new Date().toISOString()}`,
      `Network: ${this.config.network}`,
      `Domain: epay.dev`,
    ];
    return lines.join('\n');
  }

  /**
   * Build a WalletAuth payload from a wallet signature.
   */
  buildWalletAuth(sig: WalletSignature): WalletAuth {
    if (!isValidStellarPublicKey(sig.publicKey)) {
      throw new Error(`Invalid Stellar public key: ${sig.publicKey}`);
    }
    return {
      publicKey: sig.publicKey,
      signature: sig.signature,
      message: sig.message,
      network: this.config.network,
      walletProvider: sig.provider,
    };
  }

  /**
   * Validate a Stellar public key.
   */
  validatePublicKey(publicKey: string): boolean {
    return isValidStellarPublicKey(publicKey);
  }

  /**
   * Get the balance of a Stellar account via Horizon API.
   */
  async getBalance(publicKey: string): Promise<{ assetCode: string; assetIssuer: string; balance: string }[]> {
    const response = await fetch(
      `${this.config.horizonUrl}/accounts/${publicKey}`,
    );

    if (!response.ok) {
      throw new Error(`Horizon API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      balances?: { asset_code?: string; asset_issuer?: string; balance: string; asset_type: string }[];
    };

    return (data.balances ?? []).map((b) => ({
      assetCode: b.asset_type === 'native' ? 'XLM' : (b.asset_code ?? 'unknown'),
      assetIssuer: b.asset_type === 'native' ? 'native' : (b.asset_issuer ?? ''),
      balance: b.balance,
    }));
  }

  /**
   * Get account details from Horizon.
   */
  async getAccount(publicKey: string): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${this.config.horizonUrl}/accounts/${publicKey}`,
    );

    if (!response.ok) {
      throw new Error(`Horizon API error: ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  /**
   * Check if an account exists on the network.
   */
  async accountExists(publicKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.horizonUrl}/accounts/${publicKey}`,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List of supported wallet providers.
   */
  static getSupportedWallets(): WalletProvider[] {
    return ['freighter', 'xbull', 'albedo', 'rabet', 'lobstr'];
  }
}
