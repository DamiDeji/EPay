import { WalletClient, isValidStellarPublicKey } from '@epay/sdk';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { config } from '../../src/lib/config';
import { getWallet, saveWallet } from '../../src/lib/storage';

interface Balance {
  assetCode: string;
  assetIssuer: string;
  balance: string;
}

/**
 * Mobile is a watch-and-pay surface: signing keys stay in the user's hardware or
 * browser wallet. Linking an account here lets the app show balances and match
 * incoming payments to the merchant's settlement address.
 */
export default function WalletScreen(): React.ReactElement {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = React.useMemo(
    () => new WalletClient({ network: config.network, horizonUrl: config.horizonUrl }),
    [],
  );

  const loadBalances = useCallback(
    async (key: string) => {
      try {
        setError(null);
        const result = await client.getBalance(key);
        setBalances(
          result.map((b) => ({
            assetCode: b.assetCode,
            assetIssuer: b.assetIssuer,
            balance: b.balance,
          })),
        );
      } catch {
        setError('Could not reach Horizon. Check your connection.');
        setBalances([]);
      }
    },
    [client],
  );

  useEffect(() => {
    void (async () => {
      const stored = await getWallet();
      if (stored) {
        setPublicKey(stored.publicKey);
        await loadBalances(stored.publicKey);
      }
      setLoading(false);
    })();
  }, [loadBalances]);

  async function link(): Promise<void> {
    const candidate = input.trim();
    if (!isValidStellarPublicKey(candidate)) {
      setError('That is not a valid Stellar public key (G…, 56 characters).');
      return;
    }
    await saveWallet({ publicKey: candidate, provider: 'watch-only', network: config.network });
    setPublicKey(candidate);
    setInput('');
    await loadBalances(candidate);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!publicKey) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Link an account</Text>
        <Text style={styles.muted}>
          Paste the Stellar public key you settle payments to. Private keys never leave your wallet.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="G…"
          autoCapitalize="characters"
          autoCorrect={false}
          value={input}
          onChangeText={setInput}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void link()}>
          <Text style={styles.buttonText}>Link account</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Balances</Text>
      <Text style={styles.muted}>{publicKey}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {balances.map((b) => (
        <View key={`${b.assetCode}:${b.assetIssuer}`} style={styles.balanceRow}>
          <Text style={styles.asset}>{b.assetCode}</Text>
          <Text style={styles.balance}>{b.balance}</Text>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={() => void loadBalances(publicKey)}
      >
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 20, fontWeight: '700' },
  muted: { color: '#6B7280' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#DC2626' },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  asset: { fontWeight: '600' },
  balance: { fontVariant: ['tabular-nums'] },
});
