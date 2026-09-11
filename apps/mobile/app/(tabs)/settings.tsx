import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useAuth } from '../../src/lib/auth';
import { getBiometricCapability } from '../../src/lib/biometrics';
import { registerForPushNotifications } from '../../src/lib/notifications';

export default function SettingsScreen(): React.ReactElement {
  const { biometricRequired, setBiometricRequired, signOut } = useAuth();
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const onToggleBiometric = useCallback(
    async (value: boolean) => {
      if (value) {
        const capability = await getBiometricCapability();
        if (!capability.available || !capability.enrolled) {
          setPushStatus('No biometric hardware is enrolled on this device.');
          return;
        }
      }
      setBiometricRequired(value);
    },
    [setBiometricRequired],
  );

  const onEnablePush = useCallback(async () => {
    const token = await registerForPushNotifications();
    setPushStatus(
      token ? 'Push notifications enabled for receipts.' : 'Push permission was not granted.',
    );
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Require biometrics to pay</Text>
          <Text style={styles.muted}>
            Face ID or fingerprint is required before any payment is authorized.
          </Text>
        </View>
        <Switch value={biometricRequired} onValueChange={(v) => void onToggleBiometric(v)} />
      </View>

      <Pressable accessibilityRole="button" style={styles.button} onPress={() => void onEnablePush()}>
        <Text style={styles.buttonText}>Enable push receipts</Text>
      </Pressable>

      {pushStatus ? <Text style={styles.muted}>{pushStatus}</Text> : null}

      <Pressable
        accessibilityRole="button"
        style={[styles.button, styles.danger]}
        onPress={() => void signOut()}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rowText: { flex: 1, gap: 4 },
  label: { fontSize: 16, fontWeight: '600' },
  muted: { color: '#6B7280' },
  button: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  danger: { backgroundColor: '#DC2626' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
