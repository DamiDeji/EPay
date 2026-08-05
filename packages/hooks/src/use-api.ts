'use client';

import { useCallback, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface UseApiOptions {
  headers?: Record<string, string>;
}

interface ApiState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

export function useApi<T = unknown>(options: UseApiOptions = {}) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('epay_access_token');
  }, []);

  const request = useCallback(
    async <R = T>(
      path: string,
      config: RequestInit = {},
    ): Promise<R> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const token = getToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...options.headers,
          ...(config.headers as Record<string, string>),
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}${path}`, {
          ...config,
          headers,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message ?? `Request failed: ${response.status}`);
        }

        const data = (await response.json()) as R;
        setState({ data: data as unknown as T, error: null, isLoading: false });
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setState((prev) => ({ ...prev, error: message, isLoading: false }));
        throw err;
      }
    },
    [getToken, options.headers],
  );

  const get = useCallback(
    <R = T>(path: string): Promise<R> => {
      return request<R>(path, { method: 'GET' });
    },
    [request],
  );

  const post = useCallback(
    <R = T>(path: string, body?: unknown): Promise<R> => {
      return request<R>(path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    [request],
  );

  const patch = useCallback(
    <R = T>(path: string, body?: unknown): Promise<R> => {
      return request<R>(path, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    [request],
  );

  return { ...state, get, post, patch, request };
}
