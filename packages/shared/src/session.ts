/**
 * Session handling for the browser applications.
 *
 * All three front-ends previously disagreed about authentication:
 * `apps/admin-dashboard` read a token key that nothing ever wrote and then
 * deliberately ignored the result ("For demo purposes, always consider
 * authenticated"), while `apps/merchant-dashboard` and `apps/web` had no guard
 * at all, so an expired or absent session still rendered the dashboard shell.
 *
 * This module is the single implementation of "is there a usable session, and
 * where should the user be sent if not". It is deliberately pure — the storage
 * is injected — so the redirect decisions are unit-testable without a DOM.
 *
 * ## What this is not
 *
 * A client-side guard is a *navigation* control, not an authorization boundary.
 * Anything it protects is one `curl` away. The authorization boundary is the
 * API (`apps/api`), which enforces role and ownership checks server-side. The
 * guard exists so a signed-out user gets the login page instead of a shell full
 * of failing requests.
 */

/** The `localStorage`-shaped surface the helpers need. */
export interface SessionStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface SessionConfig {
  /** Where the access token lives. */
  accessTokenKey: string;
  /** Where the refresh token lives. */
  refreshTokenKey: string;
  /** Route to send an unauthenticated visitor to. */
  loginPath: string;
  /** Route to send a visitor to once signed in. */
  homePath: string;
}

export const CUSTOMER_SESSION: SessionConfig = {
  accessTokenKey: 'epay_access_token',
  refreshTokenKey: 'epay_refresh_token',
  loginPath: '/login',
  homePath: '/dashboard',
};

export const MERCHANT_SESSION: SessionConfig = {
  accessTokenKey: 'epay_access_token',
  refreshTokenKey: 'epay_refresh_token',
  loginPath: '/login',
  homePath: '/',
};

export const ADMIN_SESSION: SessionConfig = {
  accessTokenKey: 'epay_admin_token',
  refreshTokenKey: 'epay_admin_refresh_token',
  loginPath: '/login',
  homePath: '/',
};

export interface SessionTokens {
  accessToken: string;
  refreshToken?: string;
}

/**
 * Treat a token as expired this long before it actually expires.
 *
 * Without a skew, a token that expires mid-request is still considered valid
 * when the page renders, so the first API call 401s and the user sees a broken
 * screen instead of the login page.
 */
export const CLOCK_SKEW_MS = 30_000;

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '=');

  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(withPadding);
  }
  // Node without a DOM: `Buffer` is the only decoder available.
  const buffer = (
    globalThis as {
      Buffer?: {
        from: (input: string, encoding: string) => { toString: (encoding: string) => string };
      };
    }
  ).Buffer;
  if (buffer) {
    return buffer.from(withPadding, 'base64').toString('binary');
  }
  throw new Error('No base64 decoder available');
}

/** Decode a JWT's payload without verifying it. Returns `null` if unreadable. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = parts[1];
  if (!payload) return null;
  try {
    const decoded: unknown = JSON.parse(base64UrlDecode(payload));
    return decoded !== null && typeof decoded === 'object'
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether a token is expired, or so malformed that it cannot be trusted.
 *
 * Fails **closed**: an unreadable token, a missing `exp`, or a non-numeric `exp`
 * all count as expired. A token we cannot read is not a token we can rely on.
 *
 * This reads the payload without verifying the signature, which is the correct
 * trade-off for a client-side check: the server verifies the signature on every
 * request, so the only thing this needs to decide is whether the user should see
 * the login page.
 */
export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;

  const exp = payload.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return true;

  return exp * 1000 - CLOCK_SKEW_MS <= now;
}

export function storeSession(
  storage: SessionStorage,
  config: SessionConfig,
  tokens: SessionTokens,
): void {
  storage.setItem(config.accessTokenKey, tokens.accessToken);
  if (tokens.refreshToken) {
    storage.setItem(config.refreshTokenKey, tokens.refreshToken);
  }
}

export function clearSession(storage: SessionStorage, config: SessionConfig): void {
  storage.removeItem(config.accessTokenKey);
  storage.removeItem(config.refreshTokenKey);
}

export function readAccessToken(storage: SessionStorage, config: SessionConfig): string | null {
  return storage.getItem(config.accessTokenKey);
}

/** Whether the storage holds an access token that has not expired. */
export function hasValidSession(
  storage: SessionStorage,
  config: SessionConfig,
  now: number = Date.now(),
): boolean {
  const token = readAccessToken(storage, config);
  if (!token) return false;
  return !isTokenExpired(token, now);
}

/**
 * Where an unauthenticated visitor should be sent, or `null` to stay put.
 *
 * The login route itself never redirects — otherwise an unauthenticated visitor
 * would be bounced from `/login` to `/login` forever.
 */
export function resolveAuthRedirect(
  storage: SessionStorage,
  config: SessionConfig,
  pathname: string,
  now: number = Date.now(),
): string | null {
  if (pathname === config.loginPath) return null;
  if (hasValidSession(storage, config, now)) return null;
  return config.loginPath;
}
