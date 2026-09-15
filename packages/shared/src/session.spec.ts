import { describe, expect, it } from 'vitest';

import {
  ADMIN_SESSION,
  CLOCK_SKEW_MS,
  CUSTOMER_SESSION,
  MERCHANT_SESSION,
  clearSession,
  decodeJwtPayload,
  hasValidSession,
  isTokenExpired,
  readAccessToken,
  resolveAuthRedirect,
  storeSession,
  type SessionStorage,
} from './session';

/** Build a JWT-shaped token with an arbitrary payload. */
function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function memoryStorage(initial: Record<string, string> = {}): SessionStorage & {
  entries: Record<string, string>;
} {
  const entries: Record<string, string> = { ...initial };
  return {
    entries,
    getItem: (key) => entries[key] ?? null,
    setItem: (key, value) => {
      entries[key] = value;
    },
    removeItem: (key) => {
      Reflect.deleteProperty(entries, key);
    },
  };
}

const NOW = 1_700_000_000_000;

describe('decodeJwtPayload', () => {
  it('decodes a well-formed payload', () => {
    expect(decodeJwtPayload(jwt({ sub: 'user_1', exp: 123 }))).toMatchObject({
      sub: 'user_1',
      exp: 123,
    });
  });

  it('returns null for a token that is not a JWT', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
  });

  it('returns null when the payload is not JSON', () => {
    expect(decodeJwtPayload('aaa.bm90LWpzb24.signature')).toBeNull();
  });

  it('returns null when the payload is not an object', () => {
    const segment = Buffer.from('"just a string"').toString('base64url');
    expect(decodeJwtPayload(`aaa.${segment}.sig`)).toBeNull();
  });

  it('handles base64url characters that differ from standard base64', () => {
    // A payload long enough to require padding and url-safe characters.
    const token = jwt({ sub: 'user_1', roles: ['admin', 'merchant'], note: 'a+b/c?d~e' });
    expect(decodeJwtPayload(token)).toMatchObject({ sub: 'user_1' });
  });
});

describe('isTokenExpired', () => {
  it('accepts a token that expires well in the future', () => {
    const token = jwt({ exp: (NOW + 3_600_000) / 1000 });
    expect(isTokenExpired(token, NOW)).toBe(false);
  });

  it('rejects a token that has already expired', () => {
    const token = jwt({ exp: (NOW - 1000) / 1000 });
    expect(isTokenExpired(token, NOW)).toBe(true);
  });

  it('rejects a token inside the clock-skew window', () => {
    // Expires in 5s, but the skew is 30s, so it is treated as already gone.
    const token = jwt({ exp: (NOW + 5000) / 1000 });
    expect(CLOCK_SKEW_MS).toBe(30_000);
    expect(isTokenExpired(token, NOW)).toBe(true);
  });

  it('fails closed on a token with no exp claim', () => {
    expect(isTokenExpired(jwt({ sub: 'user_1' }), NOW)).toBe(true);
  });

  it('fails closed on a non-numeric exp', () => {
    expect(isTokenExpired(jwt({ exp: 'soon' }), NOW)).toBe(true);
    expect(isTokenExpired(jwt({ exp: null }), NOW)).toBe(true);
  });

  it('fails closed on an unparseable token', () => {
    expect(isTokenExpired('garbage', NOW)).toBe(true);
    expect(isTokenExpired('', NOW)).toBe(true);
  });
});

describe('storeSession / clearSession', () => {
  it('stores both tokens under the configured keys', () => {
    const storage = memoryStorage();

    storeSession(storage, MERCHANT_SESSION, { accessToken: 'a', refreshToken: 'r' });

    expect(storage.getItem('epay_access_token')).toBe('a');
    expect(storage.getItem('epay_refresh_token')).toBe('r');
  });

  it('keeps the admin session separate from the merchant session', () => {
    const storage = memoryStorage();

    storeSession(storage, ADMIN_SESSION, { accessToken: 'admin-token' });

    expect(storage.getItem('epay_admin_token')).toBe('admin-token');
    expect(storage.getItem('epay_access_token')).toBeNull();
  });

  it('does not invent a refresh token when one was not issued', () => {
    const storage = memoryStorage();

    storeSession(storage, ADMIN_SESSION, { accessToken: 'a' });

    expect(storage.getItem('epay_admin_refresh_token')).toBeNull();
  });

  it('removes both tokens on sign-out', () => {
    const storage = memoryStorage();
    storeSession(storage, ADMIN_SESSION, { accessToken: 'a', refreshToken: 'r' });

    clearSession(storage, ADMIN_SESSION);

    expect(storage.getItem('epay_admin_token')).toBeNull();
    expect(storage.getItem('epay_admin_refresh_token')).toBeNull();
  });

  it('leaves a different app session alone when signing out', () => {
    const storage = memoryStorage();
    storeSession(storage, ADMIN_SESSION, { accessToken: 'admin' });
    storeSession(storage, MERCHANT_SESSION, { accessToken: 'merchant' });

    clearSession(storage, ADMIN_SESSION);

    expect(storage.getItem('epay_access_token')).toBe('merchant');
  });
});

describe('hasValidSession', () => {
  it('is false with no stored token', () => {
    expect(hasValidSession(memoryStorage(), MERCHANT_SESSION, NOW)).toBe(false);
  });

  it('is true for a live token', () => {
    const storage = memoryStorage();
    storeSession(storage, MERCHANT_SESSION, { accessToken: jwt({ exp: (NOW + 60_000) / 1000 }) });

    expect(hasValidSession(storage, MERCHANT_SESSION, NOW)).toBe(true);
  });

  it('is false for an expired token still sitting in storage', () => {
    const storage = memoryStorage({ epay_access_token: jwt({ exp: (NOW - 1) / 1000 }) });

    expect(hasValidSession(storage, MERCHANT_SESSION, NOW)).toBe(false);
  });

  it('does not accept the admin token as a merchant session', () => {
    const storage = memoryStorage();
    storeSession(storage, ADMIN_SESSION, { accessToken: jwt({ exp: (NOW + 60_000) / 1000 }) });

    expect(hasValidSession(storage, ADMIN_SESSION, NOW)).toBe(true);
    expect(hasValidSession(storage, MERCHANT_SESSION, NOW)).toBe(false);
  });
});

describe('readAccessToken', () => {
  it('returns the token or null', () => {
    const storage = memoryStorage({ epay_access_token: 'abc' });
    expect(readAccessToken(storage, MERCHANT_SESSION)).toBe('abc');
    expect(readAccessToken(storage, ADMIN_SESSION)).toBeNull();
  });
});

describe('resolveAuthRedirect', () => {
  it('sends an anonymous visitor to the login page', () => {
    expect(resolveAuthRedirect(memoryStorage(), ADMIN_SESSION, '/', NOW)).toBe('/login');
  });

  it('leaves a signed-in visitor alone', () => {
    const storage = memoryStorage({
      epay_admin_token: jwt({ exp: (NOW + 60_000) / 1000 }),
    });

    expect(resolveAuthRedirect(storage, ADMIN_SESSION, '/merchants', NOW)).toBeNull();
  });

  it('never redirects away from the login page itself', () => {
    // Otherwise an anonymous visitor would loop between /login and /login.
    expect(resolveAuthRedirect(memoryStorage(), ADMIN_SESSION, '/login', NOW)).toBeNull();
    expect(resolveAuthRedirect(memoryStorage(), CUSTOMER_SESSION, '/login', NOW)).toBeNull();
  });

  it('treats an expired token as signed out', () => {
    const storage = memoryStorage({ epay_admin_token: jwt({ exp: (NOW - 1) / 1000 }) });

    expect(resolveAuthRedirect(storage, ADMIN_SESSION, '/', NOW)).toBe('/login');
  });

  it('uses each app own login path', () => {
    const config = { ...CUSTOMER_SESSION, loginPath: '/sign-in' };
    expect(resolveAuthRedirect(memoryStorage(), config, '/dashboard', NOW)).toBe('/sign-in');
  });
});
