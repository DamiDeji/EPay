import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Token storage.
 *
 * Access/refresh tokens and the wallet public key live in the platform
 * keystore (Keychain on iOS, EncryptedSharedPreferences on Android) via
 * `expo-secure-store`. Never write credentials to AsyncStorage.
 */
const ACCESS_TOKEN_KEY = 'epay.accessToken';
const REFRESH_TOKEN_KEY = 'epay.refreshToken';
const WALLET_KEY = 'epay.wallet';

export interface StoredWallet {
  publicKey: string;
  provider: string;
  network: string;
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveWallet(wallet: StoredWallet): Promise<void> {
  await SecureStore.setItemAsync(WALLET_KEY, JSON.stringify(wallet));
}

export async function getWallet(): Promise<StoredWallet | null> {
  const raw = await SecureStore.getItemAsync(WALLET_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredWallet;
  } catch {
    await SecureStore.deleteItemAsync(WALLET_KEY);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(WALLET_KEY),
  ]);
}

// ── Offline cache ───────────────────────────────────────────────────────────

interface CacheEnvelope<T> {
  value: T;
  /** Epoch ms after which the entry is considered stale. */
  expiresAt: number;
}

/**
 * Read-through cache with a TTL, backed by AsyncStorage.
 *
 * The app is "offline-tolerant": when a request fails we fall back to the last
 * cached value so merchants can still see their payment history and balance.
 */
export async function readCache<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(`cache:${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    return parsed.value;
  } catch {
    await AsyncStorage.removeItem(`cache:${key}`);
    return null;
  }
}

// Not generic: `value` is the only place the type would appear, so a type
// parameter bought nothing at the call site.
export async function writeCache(key: string, value: unknown, ttlMs: number): Promise<void> {
  const envelope: CacheEnvelope<unknown> = { value, expiresAt: Date.now() + ttlMs };
  await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(envelope));
}

export async function clearCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith('cache:'));
  if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
}

/**
 * Run `fetcher` and cache the result, falling back to the last cached value
 * when the network is unavailable.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60 * 1000,
): Promise<{ data: T; fromCache: boolean }> {
  try {
    const data = await fetcher();
    await writeCache(key, data, ttlMs);
    return { data, fromCache: false };
  } catch (error) {
    const cached = await readCache<T>(key);
    if (cached !== null) return { data: cached, fromCache: true };
    throw error;
  }
}
