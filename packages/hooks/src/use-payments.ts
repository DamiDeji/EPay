'use client';

import { useState, useCallback } from 'react';
import type { Payment, PaginatedResponse } from '@epay/types';
import { useApi } from './use-api';

interface UsePaymentsReturn {
  payments: Payment[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchPayments: (params?: { page?: number; pageSize?: number; status?: string }) => Promise<void>;
  getPayment: (id: string) => Promise<Payment>;
}

export function usePayments(): UsePaymentsReturn {
  const api = useApi();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(
    async (params?: { page?: number; pageSize?: number; status?: string }) => {
      setIsLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
        if (params?.status) qs.set('status', params.status);

        const result = await api.get<PaginatedResponse<Payment>>(
          `/payments?${qs.toString()}`,
        );
        setPayments(result.data);
        setTotal(result.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch payments');
      } finally {
        setIsLoading(false);
      }
    },
    [api],
  );

  const getPayment = useCallback(
    async (id: string): Promise<Payment> => {
      return api.get<Payment>(`/payments/${id}`);
    },
    [api],
  );

  return { payments, total, isLoading, error, fetchPayments, getPayment };
}
