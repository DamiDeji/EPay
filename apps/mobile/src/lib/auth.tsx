import type { User, AuthTokens } from '@epay/types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, clearSessionFromClient, hydrateAuth, setSession } from './api';
import { requireBiometric } from './biometrics';
import { clearCache, clearSession, getWallet, saveTokens } from './storage';

interface AuthState {
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  biometricRequired: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-prompt for biometrics before a sensitive action (e.g. paying). */
  authorizePayment: (reason?: string) => Promise<boolean>;
  /** Email verified on device that has an enrolled biometric module. */
  setBiometricRequired: (required: boolean) => void;
}

interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = useState<AuthState>({
    user: null,
    status: 'loading',
    biometricRequired: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [hasToken, wallet] = await Promise.all([hydrateAuth(), getWallet()]);
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          status: hasToken ? 'authenticated' : 'unauthenticated',
          biometricRequired: Boolean(wallet),
        }));
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, status: 'unauthenticated' }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, error: null }));
    try {
      const result = await api.post<LoginResponse>('/auth/login', { email, password });
      await saveTokens(result.tokens.accessToken, result.tokens.refreshToken);
      setSession(result.tokens.accessToken);
      setState((prev) => ({ ...prev, user: result.user, status: 'authenticated' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logging out locally must succeed even if the network call fails.
    }
    clearSessionFromClient();
    await Promise.all([clearSession(), clearCache()]);
    setState((prev) => ({
      ...prev,
      user: null,
      status: 'unauthenticated',
      biometricRequired: false,
      error: null,
    }));
  }, []);

  const authorizePayment = useCallback(async (reason?: string) => {
    return requireBiometric(reason ?? 'Authorize this payment');
  }, []);

  const setBiometricRequired = useCallback((required: boolean) => {
    setState((prev) => ({ ...prev, biometricRequired: required }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, authorizePayment, setBiometricRequired }),
    [state, signIn, signOut, authorizePayment, setBiometricRequired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
