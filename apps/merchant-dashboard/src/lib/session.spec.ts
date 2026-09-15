import { MERCHANT_SESSION, clearSession, resolveAuthRedirect, storeSession } from '@epay/shared';
import { describe, expect, it } from 'vitest';

/**
 * The merchant dashboard writes its session on the login page and reads it in
 * the dashboard layout. Those two places have to agree on the keys, and the
 * layout has to actually send a signed-out visitor to the login page — it
 * previously rendered the shell for everyone and let each request fail.
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

describe('merchant session configuration', () => {
  it('uses the shared customer/merchant token keys', () => {
    expect(MERCHANT_SESSION.accessTokenKey).toBe('epay_access_token');
    expect(MERCHANT_SESSION.loginPath).toBe('/login');
  });

  it('lets a signed-in merchant reach the dashboard', () => {
    const storage = memoryStorage();
    storeSession(storage, MERCHANT_SESSION, { accessToken: jwt(60_000), refreshToken: 'r' });

    expect(resolveAuthRedirect(storage, MERCHANT_SESSION, '/payments')).toBeNull();
  });

  it('redirects an anonymous visitor to the login page', () => {
    expect(resolveAuthRedirect(memoryStorage(), MERCHANT_SESSION, '/')).toBe('/login');
  });

  it('redirects once the token expires', () => {
    const storage = memoryStorage({ epay_access_token: jwt(-1) });

    expect(resolveAuthRedirect(storage, MERCHANT_SESSION, '/settlements')).toBe('/login');
  });

  it('clears the session on sign-out', () => {
    const storage = memoryStorage();
    storeSession(storage, MERCHANT_SESSION, { accessToken: jwt(60_000), refreshToken: 'r' });

    clearSession(storage, MERCHANT_SESSION);

    expect(resolveAuthRedirect(storage, MERCHANT_SESSION, '/')).toBe('/login');
  });
});
