import type { TONNetwork, WalletAuth } from '@epay/types';
import { isValidTonAddress } from './utils';

/**
 * Configuration for wallet authentication with a TON wallet.
 */
export interface WalletConfig {
  network: TONNetwork;
  rpcEndpoint?: string;
}

/**
 * Result of a wallet signature request.
 */
export interface WalletSignature {
  address: string;
  publicKey: string;
  signature: string;
  message: string;
}

/**
 * High-level wallet integration utilities for connecting TON wallets
 * and signing authentication messages.
 *
 * In production, integrate with TON Connect SDK (@tonconnect/sdk)
 * or Tonkeeper SDK to get real wallet signatures.
 */
export class WalletClient {
  readonly config: WalletConfig;

  constructor(config: WalletConfig) {
    this.config = { rpcEndpoint: 'https://toncenter.com/api/v2/jsonRPC', ...config };
  }

  /**
   * Generate an authentication message for a wallet to sign.
   * This creates a unique nonce-based message that proves wallet ownership.
   */
  generateAuthMessage(address: string): string {
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return `EPay Authentication: Sign this message to prove you own ${address}\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}\nNetwork: ${this.config.network}`;
  }

  /**
   * Build a WalletAuth payload from a wallet signature.
   */
  buildWalletAuth(sig: WalletSignature): WalletAuth {
    if (!isValidTonAddress(sig.address)) {
      throw new Error(`Invalid TON address: ${sig.address}`);
    }
    return {
      address: sig.address,
      publicKey: sig.publicKey,
      signature: sig.signature,
      message: sig.message,
      network: this.config.network,
    };
  }

  /**
   * Validate a TON address.
   */
  validateAddress(address: string): boolean {
    return isValidTonAddress(address);
  }

  /**
   * Get the balance of a TON address (via public RPC).
   * Returns balance in nanoTON as string.
   */
  async getBalance(address: string): Promise<string> {
    const response = await fetch(this.config.rpcEndpoint!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'getAddressInformation',
        params: { address },
      }),
    });

    const data = await response.json() as Record<string, unknown>;
    if (data.error) {
      throw new Error(`TON RPC error: ${JSON.stringify(data.error)}`);
    }

    const result = data.result as { balance?: string } | undefined;
    return result?.balance ?? '0';
  }
}
