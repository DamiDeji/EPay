import type { Payment, PaymentStatus } from '@epay/types';
import { Link, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '../../src/lib/api';
import { withCache } from '../../src/lib/storage';

const STATUS_COLORS: Record<PaymentStatus, string> = {
  PENDING: '#D97706',
  PROCESSING: '#2563EB',
  CONFIRMED: '#0891B2',
  COMPLETED: '#16A34A',
  FAILED: '#DC2626',
  REFUNDED: '#7C3AED',
  PARTIALLY_REFUNDED: '#7C3AED',
  CANCELLED: '#6B7280',
  EXPIRED: '#6B7280',
} as Record<PaymentStatus, string>;

function formatAmount(amount: string, code: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${code}`;
  // Stellar amounts are stringified integer units; show up to 7 decimals.
  return `${(value / 1e7).toFixed(2)} ${code}`;
}

export default function PaymentsScreen(): React.ReactElement {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, fromCache: cached } = await withCache(
        'payments:recent',
        () => api.payments.list({ pageSize: 25 }),
        60_000,
      );
      setPayments(data.data);
      setFromCache(cached);
    } catch {
      setPayments([]);
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {(fromCache || payments.length === 0) && (
        <Text style={styles.banner}>
          {payments.length === 0
            ? 'No payments yet.'
            : 'Offline — showing your last synced payments.'}
        </Text>
      )}

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.muted}>Pull to refresh.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={styles.row}
            onPress={() => router.push(`/payments/${item.id}`)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.amount}>{formatAmount(item.amount, item.asset.code)}</Text>
              <Text style={styles.muted} numberOfLines={1}>
                {item.description ?? item.paymentId}
              </Text>
            </View>
            <Text style={[styles.status, { color: STATUS_COLORS[item.status] }]}>
              {item.status}
            </Text>
          </Pressable>
        )}
      />

      <Link href="/scan" asChild>
        <Pressable accessibilityRole="button" style={styles.scanButton}>
          <Text style={styles.scanText}>Scan to pay</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  banner: { color: '#6B7280', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  rowMain: { flex: 1, gap: 4 },
  amount: { fontSize: 16, fontWeight: '600' },
  muted: { color: '#6B7280' },
  status: { fontSize: 12, fontWeight: '700' },
  scanButton: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  scanText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
