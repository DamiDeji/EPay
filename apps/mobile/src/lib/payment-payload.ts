import { isValidStellarPublicKey } from '@epay/sdk';

/**
 * A QR code on an EPay payment request can arrive in several shapes. We parse
 * them into a single discriminated union so the scan screen has one code path.
 */
export type ParsedPayment =
  | {
      kind: 'address';
      publicKey: string;
      amount?: string;
      assetCode?: string;
      assetIssuer?: string;
      memo?: string;
      description?: string;
    }
  | { kind: 'payment-link'; code: string }
  | { kind: 'invalid'; reason: string };

/**
 * React Native's `URL` implementation is incomplete, so parse manually rather
 * than relying on `URLSearchParams`.
 */
function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
    } catch {
      out[rawKey] = rawValue;
    }
  }
  return out;
}

function isPaymentLinkCode(value: string): boolean {
  return /^[A-Za-z0-9_-]{4,64}$/.test(value);
}

export function parsePaymentPayload(raw: string): ParsedPayment {
  const input = raw.trim();
  if (!input) return { kind: 'invalid', reason: 'Empty QR payload' };

  // Raw JSON payload (merchant print, POS receipt).
  if (input.startsWith('{')) {
    try {
      const parsed = JSON.parse(input) as Record<string, unknown>;
      const publicKey = typeof parsed.to === 'string' ? parsed.to : parsed.publicKey;
      if (typeof publicKey === 'string' && isValidStellarPublicKey(publicKey)) {
        return {
          kind: 'address',
          publicKey,
          amount: typeof parsed.amount === 'string' ? parsed.amount : undefined,
          assetCode: typeof parsed.asset === 'string' ? parsed.asset : undefined,
          memo: typeof parsed.memo === 'string' ? parsed.memo : undefined,
          description: typeof parsed.description === 'string' ? parsed.description : undefined,
        };
      }
      if (typeof parsed.code === 'string') {
        return { kind: 'payment-link', code: parsed.code };
      }
    } catch {
      return { kind: 'invalid', reason: 'Malformed JSON in QR code' };
    }
  }

  // SEP-0007: stellar:<account>?amount=..&asset_code=..&asset_issuer=..&memo=..
  if (input.toLowerCase().startsWith('stellar:')) {
    const rest = input.slice('stellar:'.length);
    const [account = '', query = ''] = rest.split('?');
    if (!isValidStellarPublicKey(account)) {
      return { kind: 'invalid', reason: 'SEP-0007 QR has an invalid Stellar account' };
    }
    const params = parseQuery(query);
    return {
      kind: 'address',
      publicKey: account,
      amount: params.amount,
      assetCode: params.asset_code ?? params.assetCode,
      assetIssuer: params.asset_issuer ?? params.assetIssuer,
      memo: params.memo,
      description: params.msg ?? params.description,
    };
  }

  // epay://pay?to=<account>&amount=..&asset=..&memo=..&description=..
  if (input.toLowerCase().startsWith('epay://')) {
    const rest = input.slice('epay://'.length);
    const queryIndex = rest.indexOf('?');
    const query = queryIndex === -1 ? '' : rest.slice(queryIndex + 1);
    const params = parseQuery(query);
    const to = params.to ?? params.publicKey;
    if (to && isValidStellarPublicKey(to)) {
      return {
        kind: 'address',
        publicKey: to,
        amount: params.amount,
        assetCode: params.asset ?? params.assetCode,
        assetIssuer: params.assetIssuer,
        memo: params.memo,
        description: params.description,
      };
    }
    const code = params.code;
    if (code && isPaymentLinkCode(code)) return { kind: 'payment-link', code };
    return { kind: 'invalid', reason: 'EPay URI is missing a destination account' };
  }

  // https://<host>/pay/<code> — a hosted EPay payment link.
  if (/^https?:\/\//i.test(input)) {
    const match = /\/pay\/([A-Za-z0-9_-]{4,64})/.exec(input);
    if (match?.[1]) return { kind: 'payment-link', code: match[1] };
    return { kind: 'invalid', reason: 'URL is not an EPay payment link' };
  }

  // Bare Stellar account.
  if (isValidStellarPublicKey(input)) return { kind: 'address', publicKey: input };

  // Bare payment-link code.
  if (isPaymentLinkCode(input)) return { kind: 'payment-link', code: input };

  return { kind: 'invalid', reason: 'Unrecognized QR code format' };
}
