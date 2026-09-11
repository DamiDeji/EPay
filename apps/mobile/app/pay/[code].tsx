import { useLocalSearchParams, useRouter } from 'expo-router';
import type { PaymentLink, Merchant } from '@epay/types';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { withCache } from '../../src/lib/storage';

export default function ConfirmPaymentScreen(): React.ReactElement {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { authorizePayment, biometricRequired } = useAuth();
  const router = useRouter();

  const [link, setLink] = useState<PaymentLink | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!code) return;
      try {
        const { data: fetchedLink } = await withCache(`link:${code}`, () =>
          api.paymentLinks.getByCode(code),
        );
        setLink(fetchedLink);
        const { data: fetchedMerchant } = await withCache(
          `merchant:${fetchedLink.merchantId}`,
          () => api.merchants.getById(fetchedLink.merchantId),
        );
        setMerchant(fetchedMerchant);
      } catch {
        setError('This payment link could not be loaded.');
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const onConfirm = useCallback(async () => {
    if (!link || !merchant?.settlementPublicKey) {
      setError('This merchant has no settlement account configured.');
      return;
    }

    if (biometricRequired) {
      const authorized = await authorizePayment(
        `Pay ${link.amount} ${link.asset.code}`,
      );
      if (!authorized) {
        setError('Payment cancelled — biometric check failed.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const payment = await api.payments.create({
        merchantId: link.merchantId,
        amount: link.amount,
        asset: link.asset,
        recipientPublicKey: merchant.settlementPublicKey,
        description: link.description ?? undefined,
        metadata: { source: 'mobile', paymentLinkCode: link.code },
      });
      router.replace(`/payments/${payment.id}`);
    } catch {
      setError('Payment could not be created. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [link, merchant, biometricRequired, authorizePayment, router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!link) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Payment link not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{merchant?.businessName ?? 'EPay merchant'}</Text>
      <Text style={styles.amount}>
        {link.amount} {link.asset.code}
      </Text>
      {link.description ? <Text style={styles.muted}>{link.description}</Text> : null}

      <View style={styles.card}>
        <Row label="Network" value={(merchant?.settlementPublicKey ?? '').slice(0, 8) || '—'} />
        <Row label="Payment link" value={link.code} />
        <Row label="Destination" value={merchant?.settlementPublicKey ? 'Merchant wallet' : 'Missing'} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={submitting}
        onPress={() => void onConfirm()}
        style={[styles.button, submitting && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {biometricRequired ? 'Authorize & pay' : 'Confirm payment'}
          </Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => Alert.alert('Non-custodial', 'Funds move directly from your wallet to the merchant on Stellar.')}
      >
        <Text style={styles.link}>How funds move</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  heading: { fontSize: 18, fontWeight: '600', color: '#374151' },
  amount: { fontSize: 34, fontWeight: '800' },
  muted: { color: '#6B7280' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowValue: { fontWeight: '600' },
  button: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#DC2626' },
  link: { color: '#2563EB', textAlign: 'center', marginTop: 4 },
});
