/**
 * Persisted extension settings.
 *
 * `chrome.storage.local` is used rather than `localStorage` so settings survive
 * service-worker restarts and are shared between the popup and the background
 * worker. Secrets are intentionally *not* stored here beyond the session token
 * the user explicitly opts into.
 */
export interface ExtensionSettings {
  /** EPay web app used for the hosted checkout flow. */
  webUrl: string;
  /** EPay REST API base URL. */
  apiUrl: string;
  /** Optional bearer token for authenticated merchant actions. */
  accessToken: string | null;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  webUrl: 'http://localhost:3000',
  apiUrl: 'http://localhost:4000',
  accessToken: null,
};

const KEY = 'epay.settings';

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(KEY);
  const value = stored[KEY] as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(value ?? {}) };
}

export async function saveSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
