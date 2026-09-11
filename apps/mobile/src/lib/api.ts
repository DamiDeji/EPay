import { EPayClient } from '@epay/sdk';

import { config } from './config';
import { getAccessToken } from './storage';

/**
 * Shared `@epay/sdk` client for the mobile app.
 *
 * All API calls go through the same client instance the web dashboards use, so
 * retry/timeout/auth behaviour stays consistent across surfaces. The client is
 * constructed lazily and its bearer token is refreshed from secure storage
 * before every authenticated call.
 */
export const api = new EPayClient({
  apiUrl: config.apiUrl,
});

let hydrated = false;

/** Load the persisted access token into the SDK client (once per app launch). */
export async function hydrateAuth(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;
  api.setAccessToken(token);
  hydrated = true;
  return true;
}

export function isHydrated(): boolean {
  return hydrated;
}

export function setSession(accessToken: string): void {
  api.setAccessToken(accessToken);
  hydrated = true;
}

export function clearSessionFromClient(): void {
  api.clearAuth();
  hydrated = false;
}
