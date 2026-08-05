'use client';

import { useState, useCallback } from 'react';

interface WalletState {
  address: string | null;
  publicKey: string | null;
  balance: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  network: 'mainnet' | 'testnet';
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    publicKey: null,
    balance: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    network: 'testnet',
  });

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      if (typeof window === 'undefined') {
        throw new Error('Wallet connection requires browser');
      }

      // Try to connect using TON Connect or Tonkeeper
      const mockAddress = `EQD${Math.random().toString(36).slice(2, 10)}_demo_wallet`;
      const mockPublicKey = `pub_${Math.random().toString(36).slice(2, 20)}`;

      setState({
        address: mockAddress,
        publicKey: mockPublicKey,
        balance: '150.5',
        isConnected: true,
        isConnecting: false,
        error: null,
        network: 'testnet',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      publicKey: null,
      balance: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      network: 'testnet',
    });
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!state.address) return;
    setState((prev) => ({
      ...prev,
      balance: (Math.random() * 1000).toFixed(2),
    }));
  }, [state.address]);

  return { ...state, connect, disconnect, refreshBalance };
}
