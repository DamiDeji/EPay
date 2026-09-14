import { getExplorerUrl } from '@epay/sdk';
import type { Payment } from '@epay/types';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '../../src/lib/api';
import { config } from '../../src/lib/config';

export default function PaymentDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      try {
        setPayment(await api.payments.getById(id));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!payment) {
    return (
      <View style={styles.centered}>
        <Text>Payment not found.</Text>
      </View>
    );
  }

  const explorerUrl = payment.txHash ? getExplorerUrl('tx', payment.txHash, config.network) : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.amount}>
        {payment.amount} {payment.asset.code}
      </Text>
      <Text style={styles.status}>{payment.status}</Text>

      <View style={styles.card}>
        <Row label="Payment ID" value={payment.paymentId} />
        <Row label="Recipient" value={payment.recipientPublicKey} />
        {payment.payerPublicKey ? <Row label="Payer" value={payment.payerPublicKey} /> : null}
        {payment.memo ? <Row label="Memo" value={payment.memo} /> : null}
        <Row label="Ledger" value={payment.ledgerSequence?.toString() ?? 'Pending'} />
      </View>

      {explorerUrl ? (
        <Pressable
          accessibilityRole="link"
          style={styles.button}
          onPress={() => void Linking.openURL(explorerUrl)}
        >
          <Text style={styles.buttonText}>View on Stellar explorer</Text>
        </Pressable>
      ) : null}

      <Text style={styles.muted}>Network: {config.network}</Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  amount: { fontSize: 30, fontWeight: '800' },
  status: { fontSize: 16, fontWeight: '700', color: '#16A34A' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowValue: { fontWeight: '600', flexShrink: 1 },
  muted: { color: '#6B7280' },
  button: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
