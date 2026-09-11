import { describe, expect, it } from 'vitest';

import { parsePaymentPayload } from './payment-payload';

// `G` followed by 55 base32 characters (RFC 4648 alphabet A–Z and 2–7), which is
// what `isValidStellarPublicKey` accepts.
const ACCOUNT = `G${'A'.repeat(55)}`;

describe('parsePaymentPayload', () => {
  it('parses a bare Stellar account', () => {
    expect(parsePaymentPayload(ACCOUNT)).toEqual({ kind: 'address', publicKey: ACCOUNT });
  });

  it('parses a SEP-0007 stellar URI', () => {
    const result = parsePaymentPayload(
      `stellar:${ACCOUNT}?amount=25&asset_code=USDC&asset_issuer=GISSUER&memo=inv-1&msg=Invoice`,
    );
    expect(result).toEqual({
      kind: 'address',
      publicKey: ACCOUNT,
      amount: '25',
      assetCode: 'USDC',
      assetIssuer: 'GISSUER',
      memo: 'inv-1',
      description: 'Invoice',
    });
  });

  it('parses an epay:// URI with a destination account', () => {
    const result = parsePaymentPayload(
      `epay://pay?to=${ACCOUNT}&amount=10&asset=XLM&description=Coffee`,
    );
    expect(result).toEqual({
      kind: 'address',
      publicKey: ACCOUNT,
      amount: '10',
      assetCode: 'XLM',
      assetIssuer: undefined,
      memo: undefined,
      description: 'Coffee',
    });
  });

  it('parses an epay:// URI that carries a payment-link code', () => {
    expect(parsePaymentPayload('epay://pay?code=abc123')).toEqual({
      kind: 'payment-link',
      code: 'abc123',
    });
  });

  it('extracts the code from a hosted payment link URL', () => {
    expect(parsePaymentPayload('https://epay.dev/pay/link_9XyZ')).toEqual({
      kind: 'payment-link',
      code: 'link_9XyZ',
    });
  });

  it('parses a raw JSON payload', () => {
    const result = parsePaymentPayload(
      JSON.stringify({ to: ACCOUNT, amount: '5', asset: 'XLM', memo: 'm1' }),
    );
    expect(result).toMatchObject({ kind: 'address', publicKey: ACCOUNT, amount: '5' });
  });

  it('treats an unrecognized link as a payment-link code', () => {
    expect(parsePaymentPayload('somecode1')).toEqual({ kind: 'payment-link', code: 'somecode1' });
  });

  it('rejects an empty payload', () => {
    expect(parsePaymentPayload('   ')).toEqual({ kind: 'invalid', reason: 'Empty QR payload' });
  });

  it('rejects invalid SEP-0007 accounts', () => {
    const result = parsePaymentPayload('stellar:not-an-account?amount=1');
    expect(result.kind).toBe('invalid');
  });

  it('rejects non-EPay URLs', () => {
    const result = parsePaymentPayload('https://example.com/hello');
    expect(result).toEqual({ kind: 'invalid', reason: 'URL is not an EPay payment link' });
  });

  it('rejects malformed JSON', () => {
    const result = parsePaymentPayload('{ "to": ');
    expect(result).toEqual({ kind: 'invalid', reason: 'Malformed JSON in QR code' });
  });
});
