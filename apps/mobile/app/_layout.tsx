import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/lib/auth';
import { configureNotificationHandler } from '../src/lib/notifications';

configureNotificationHandler();

export default function RootLayout(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" options={{ headerShown: true, title: 'Sign in' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="scan"
            options={{ presentation: 'modal', headerShown: true, title: 'Scan to pay' }}
          />
          <Stack.Screen
            name="pay/[code]"
            options={{ headerShown: true, title: 'Confirm payment' }}
          />
          <Stack.Screen
            name="payments/[id]"
            options={{ headerShown: true, title: 'Payment' }}
          />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
