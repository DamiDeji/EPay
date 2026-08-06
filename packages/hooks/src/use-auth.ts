'use client';

import type { User, AuthTokens } from '@epay/types';
import { useState, useEffect, useCallback } from 'react';

import { useApi } from './use-api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const api = useApi();

  useEffect(() => {
    const token = localStorage.getItem('epay_access_token');
    if (token) {
      setAuthState({ user: null, isAuthenticated: true, isLoading: false });
    } else {
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const result = await api.post<{ user: User; tokens: AuthTokens }>('/auth/login', {
        email,
        password,
      });

      localStorage.setItem('epay_access_token', result.tokens.accessToken);
      localStorage.setItem('epay_refresh_token', result.tokens.refreshToken);
      setAuthState({ user: result.user, isAuthenticated: true, isLoading: false });
    },
    [api],
  );

  const loginWithWallet = useCallback(
    async (stellarPublicKey: string, signature: string, message: string): Promise<void> => {
      const result = await api.post<{ user: User; tokens: AuthTokens }>('/auth/login', {
        stellarPublicKey,
        signature,
        message,
      });

      localStorage.setItem('epay_access_token', result.tokens.accessToken);
      localStorage.setItem('epay_refresh_token', result.tokens.refreshToken);
      setAuthState({ user: result.user, isAuthenticated: true, isLoading: false });
    },
    [api],
  );

  const register = useCallback(
    async (
      email: string,
      displayName: string,
      password: string,
    ): Promise<void> => {
      const result = await api.post<{ user: User; tokens: AuthTokens }>('/auth/register', {
        email,
        displayName,
        password,
      });

      localStorage.setItem('epay_access_token', result.tokens.accessToken);
      localStorage.setItem('epay_refresh_token', result.tokens.refreshToken);
      setAuthState({ user: result.user, isAuthenticated: true, isLoading: false });
    },
    [api],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('epay_access_token');
    localStorage.removeItem('epay_refresh_token');
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return { ...authState, login, loginWithWallet, register, logout };
}
