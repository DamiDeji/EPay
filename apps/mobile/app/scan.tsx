import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { parsePaymentPayload } from '../src/lib/payment-payload';

export default function ScanScreen(): React.ReactElement {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const onScan = useCallback(
    ({ data }: { data: string }) => {
      // Barcode callbacks fire many times per second; accept only the first.
      if (handled.current) return;
      handled.current = true;

      const parsed = parsePaymentPayload(data);
      if (parsed.kind === 'payment-link') {
        router.replace(`/pay/${parsed.code}`);
        return;
      }
      if (parsed.kind === 'address') {
        const params = new URLSearchParams({ to: parsed.publicKey });
        if (parsed.amount) params.set('amount', parsed.amount);
        if (parsed.assetCode) params.set('asset', parsed.assetCode);
        router.replace(`/pay/~direct?${params.toString()}`);
        return;
      }

      handled.current = false;
      setError(parsed.reason);
    },
    [router],
  );

  if (!permission) {
    return <View style={styles.centered} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>EPay needs camera access to scan payment QR codes.</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => void requestPermission()}
        >
          <Text style={styles.buttonText}>Grant camera access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScan}
      />
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  message: { textAlign: 'center', color: '#374151' },
  button: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  errorBanner: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#fff' },
});
