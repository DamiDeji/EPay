import { StellarNetwork } from '@epay/types';
import Constants from 'expo-constants';

/**
 * Runtime configuration for the mobile app.
 *
 * Expo only inlines env vars prefixed with `EXPO_PUBLIC_`, so these must be
 * provided at build time (see `apps/mobile/.env.example`).
 */
export interface MobileConfig {
  apiUrl: string;
  network: StellarNetwork;
  horizonUrl: string;
  sorobanRpcUrl: string;
  /** EAS project id, required to request an Expo push token. */
  pushProjectId: string | null;
}

const NETWORK: StellarNetwork =
  (process.env.EXPO_PUBLIC_STELLAR_NETWORK as StellarNetwork | undefined) ?? StellarNetwork.TESTNET;

export const config: MobileConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  network: NETWORK,
  horizonUrl: process.env.EXPO_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: process.env.EXPO_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  pushProjectId:
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    null,
};
