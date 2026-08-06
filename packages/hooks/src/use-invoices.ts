'use client';

import type { Invoice, PaginatedResponse } from '@epay/types';
import { useState, useCallback } from 'react';

import { useApi } from './use-api';

interface UseInvoicesReturn {
  invoices: Invoice[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchInvoices: (params?: { page?: number; pageSize?: number; status?: string }) => Promise<void>;
  getInvoice: (id: string) => Promise<Invoice>;
}

export function useInvoices(): UseInvoicesReturn {
  const api = useApi();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(
    async (params?: { page?: number; pageSize?: number; status?: string }) => {
      setIsLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
        if (params?.status) qs.set('status', params.status);

        const result = await api.get<PaginatedResponse<Invoice>>(
          `/invoices?${qs.toString()}`,
        );
        setInvoices(result.data);
        setTotal(result.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
      } finally {
        setIsLoading(false);
      }
    },
    [api],
  );

  const getInvoice = useCallback(
    async (id: string): Promise<Invoice> => {
      return api.get<Invoice>(`/invoices/${id}`);
    },
    [api],
  );

  return { invoices, total, isLoading, error, fetchInvoices, getInvoice };
}
