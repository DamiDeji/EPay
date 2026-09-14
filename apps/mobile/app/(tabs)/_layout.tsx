import { Tabs } from 'expo-router';
import React from 'react';

export default function TabsLayout(): React.ReactElement {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="payments" options={{ title: 'Payments' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
