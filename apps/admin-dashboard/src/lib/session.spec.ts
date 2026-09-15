import { ADMIN_SESSION, clearSession, resolveAuthRedirect, storeSession } from '@epay/shared';
import { describe, expect, it } from 'vitest';

/**
 * The admin console authenticates against the same API as the merchant
 * dashboard but keeps its own session keys, so signing out of one does not sign
 * the other out.
 *
 * The bug this guards against is the one that shipped: the login page and the
 * dashboard layout disagreed about where the token lives — the layout read
 * `epay_admin_token`, and nothing ever wrote it, so the guard could not work.
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

describe('admin session configuration', () => {
  it('uses dedicated storage keys, not the merchant ones', () => {
    expect(ADMIN_SESSION.accessTokenKey).toBe('epay_admin_token');
    expect(ADMIN_SESSION.refreshTokenKey).toBe('epay_admin_refresh_token');
    expect(ADMIN_SESSION.loginPath).toBe('/login');
  });

  it('round-trips a session through the same keys the guard reads', () => {
    const storage = memoryStorage();

    storeSession(storage, ADMIN_SESSION, { accessToken: jwt(60_000), refreshToken: 'refresh-1' });

    expect(storage.entries.epay_admin_token).toBeDefined();
    expect(storage.entries.epay_admin_refresh_token).toBe('refresh-1');
    expect(resolveAuthRedirect(storage, ADMIN_SESSION, '/merchants')).toBeNull();
  });

  it('sends an anonymous visitor to the login page instead of rendering the shell', () => {
    const storage = memoryStorage();

    expect(resolveAuthRedirect(storage, ADMIN_SESSION, '/')).toBe('/login');
    expect(resolveAuthRedirect(storage, ADMIN_SESSION, '/audit-log')).toBe('/login');
  });

  it('sends a visitor with an expired token back to the login page', () => {
    const storage = memoryStorage({
      epay_admin_token: jwt(-1000),
    });

    expect(resolveAuthRedirect(storage, ADMIN_SESSION, '/')).toBe('/login');
  });

  it('clears both keys on sign-out', () => {
    const storage = memoryStorage();
    storeSession(storage, ADMIN_SESSION, { accessToken: jwt(60_000), refreshToken: 'r' });

    clearSession(storage, ADMIN_SESSION);

    expect(storage.entries).toEqual({});
  });

  it('does not treat a merchant session as an admin session', () => {
    const storage = memoryStorage({ epay_access_token: jwt(60_000) });

    expect(resolveAuthRedirect(storage, ADMIN_SESSION, '/')).toBe('/login');
  });
});
