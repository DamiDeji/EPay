'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WalletProvider, StellarNetwork } from '@epay/types';

interface StellarWalletState {
  connected: boolean;
  publicKey: string | null;
  provider: WalletProvider | null;
  network: StellarNetwork;
  error: string | null;
  connecting: boolean;
}

/**
 * React hook for Stellar wallet integration.
 * Supports: Freighter, xBull, Albedo, Rabet, Lobstr
 */
export function useWallet() {
  const [state, setState] = useState<StellarWalletState>({
    connected: false,
    publicKey: null,
    provider: null,
    network: 'testnet',
    error: null,
    connecting: false,
  });

  // Auto-reconnect on mount
  useEffect(() => {
    const saved = localStorage.getItem('epay_stellar_wallet');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          publicKey: string;
          provider: WalletProvider;
          network: StellarNetwork;
        };
        setState((prev) => ({
          ...prev,
          connected: true,
          publicKey: parsed.publicKey,
          provider: parsed.provider,
          network: parsed.network,
        }));
      } catch {
        localStorage.removeItem('epay_stellar_wallet');
      }
    }
  }, []);

  /**
   * Connect to a Stellar wallet provider.
   *
   * In production, this integrates directly with each wallet's browser extension API:
   * - Freighter: window.freighterApi.getPublicKey()
   * - xBull: window.xBullSDK.connect()
   * - Albedo: albedo.publicKey()
   */
  const connect = useCallback(async (provider: WalletProvider) => {
    setState((prev) => ({ ...prev, connecting: true, error: null }));

    try {
      let publicKey: string;

      // In production, integrate with actual wallet APIs
      // For now, use a mock flow
      switch (provider) {
        case 'freighter':
          // const result = await window.freighterApi.getPublicKey();
          // publicKey = result;
          publicKey = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234';
          break;
        case 'xbull':
          // const connection = await window.xBullSDK.connect({ canRequestPublicKey: true });
          // publicKey = connection.publicKey;
          publicKey = 'GDEFGH1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234';
          break;
        case 'albedo':
          // const albedoResponse = await albedo.publicKey();
          // publicKey = albedoResponse.pubkey;
          publicKey = 'GHIJKL1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234';
          break;
        case 'rabet':
          publicKey = 'GMNOPQ1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234';
          break;
        case 'lobstr':
          publicKey = 'GSTUVW1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234';
          break;
        default:
          throw new Error(`Unsupported wallet provider: ${provider}`);
      }

      const walletData = {
        publicKey,
        provider,
        network: state.network,
      };

      localStorage.setItem('epay_stellar_wallet', JSON.stringify(walletData));

      setState((prev) => ({
        ...prev,
        connected: true,
        publicKey,
        provider,
        connecting: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
        connecting: false,
      }));
    }
  }, [state.network]);

  /**
   * Disconnect the current wallet.
   */
  const disconnect = useCallback(() => {
    localStorage.removeItem('epay_stellar_wallet');
    setState({
      connected: false,
      publicKey: null,
      provider: null,
      network: state.network,
      error: null,
      connecting: false,
    });
  }, [state.network]);

  /**
   * Sign a message with the connected wallet.
   */
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!state.publicKey || !state.provider) {
      throw new Error('No wallet connected');
    }

    // In production, use the wallet's signing API
    // e.g., await window.freighterApi.signMessage(message);
    return `mock_signature_${Date.now().toString(36)}`;
  }, [state.publicKey, state.provider]);

  /**
   * Switch the Stellar network.
   */
  const switchNetwork = useCallback((network: StellarNetwork) => {
    setState((prev) => ({ ...prev, network }));
  }, []);

  /**
   * Returns list of supported wallet providers.
   */
  const getSupportedWallets = useCallback((): { provider: WalletProvider; label: string; icon: string }[] => {
    return [
      { provider: 'freighter', label: 'Freighter', icon: '🦊' },
      { provider: 'xbull', label: 'xBull', icon: '🐂' },
      { provider: 'albedo', label: 'Albedo', icon: '☀️' },
      { provider: 'rabet', label: 'Rabet', icon: '🐇' },
      { provider: 'lobstr', label: 'Lobstr', icon: '🦞' },
    ];
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    signMessage,
    switchNetwork,
    getSupportedWallets,
  };
}
