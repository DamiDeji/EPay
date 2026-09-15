import { CUSTOMER_SESSION, clearSession, resolveAuthRedirect, storeSession } from '@epay/shared';
import { describe, expect, it } from 'vitest';

/**
 * The customer app registers and signs in on `/login` and `/register`, both of
 * which write `epay_access_token`, and the dashboard layout guards on the same
 * key. The dashboard previously rendered for anonymous visitors.
 */
function memoryStorage(initial: Record<string, string> = {}) {
  const entries: Record<string, string> = { ...initial };
  return {
    entries,
    getItem: (key: string) => entries[key] ?? null,
    setItem: (key: string, value: string) => {
      entries[key] = value;
    },
    removeItem: (key: string) => {
      Reflect.deleteProperty(entries, key);
    },
  };
}

function jwt(expiresInMs: number): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ exp: (Date.now() + expiresInMs) / 1000 })}.sig`;
}

describe('customer session configuration', () => {
  it('guards the dashboard with the key the login and register pages write', () => {
    expect(CUSTOMER_SESSION.accessTokenKey).toBe('epay_access_token');
    expect(CUSTOMER_SESSION.homePath).toBe('/dashboard');
  });

  it('admits a customer with a live token', () => {
    const storage = memoryStorage();
    storeSession(storage, CUSTOMER_SESSION, { accessToken: jwt(60_000) });

    expect(resolveAuthRedirect(storage, CUSTOMER_SESSION, '/dashboard/wallet')).toBeNull();
  });

  it('sends an anonymous visitor to the login page', () => {
    expect(resolveAuthRedirect(memoryStorage(), CUSTOMER_SESSION, '/dashboard')).toBe('/login');
  });

  it('never redirects away from the login page', () => {
    expect(resolveAuthRedirect(memoryStorage(), CUSTOMER_SESSION, '/login')).toBeNull();
  });

  it('treats an expired token as signed out', () => {
    const storage = memoryStorage({ epay_access_token: jwt(-5_000) });

    expect(resolveAuthRedirect(storage, CUSTOMER_SESSION, '/dashboard')).toBe('/login');
  });

  it('clears both tokens on sign-out', () => {
    const storage = memoryStorage();
    storeSession(storage, CUSTOMER_SESSION, { accessToken: jwt(60_000), refreshToken: 'r' });

    clearSession(storage, CUSTOMER_SESSION);

    expect(storage.entries).toEqual({});
  });
});
