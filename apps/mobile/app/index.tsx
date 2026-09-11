import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../src/lib/auth';

export default function Index(): React.ReactElement {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={status === 'authenticated' ? '/(tabs)/payments' : '/login'} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
