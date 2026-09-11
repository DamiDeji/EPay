# @epay/mobile

The EPay mobile client — a merchant/customer surface for Stellar payments built
with [Expo](https://expo.dev) and [`expo-router`](https://docs.expo.dev/router/introduction/).

It reuses `@epay/sdk` and `@epay/types` from the monorepo, so there is no
duplicated API logic and no separate API surface to keep in sync.

## Features

| Capability | Implementation |
| --- | --- |
| QR-code payment scanning | `expo-camera` (`CameraView` + barcode scanner) → `src/lib/payment-payload.ts` |
| Biometric gate for payments | `expo-local-authentication` via `src/lib/biometrics.ts` (`disableDeviceFallback` so a stolen unlocked phone cannot pay) |
| Secure token storage | `expo-secure-store` (Keychain / EncryptedSharedPreferences) in `src/lib/storage.ts` |
| Push receipts | `expo-notifications` in `src/lib/notifications.ts` |
| Offline-tolerant caching | AsyncStorage TTL cache + `withCache()` fallback in `src/lib/storage.ts` |
| Wallet connect | `useWallet`-equivalent flows through `@epay/sdk`'s `WalletClient` |

Both iOS and Android ship from this single codebase.

## Accepted QR payloads

`src/lib/payment-payload.ts` normalizes every format EPay issues:

- `epay://pay?to=G…&amount=10&asset=XLM&description=Coffee`
- `epay://pay?code=<paymentLinkCode>`
- `https://<host>/pay/<code>` (hosted payment link)
- `stellar:G…?amount=25&asset_code=USDC&asset_issuer=…&memo=…` (SEP-0007)
- a raw Stellar account (`G…`)
- raw JSON emitted by EPay POS receipts

## Setup

```bash
# 1. Pin Expo-managed dependency versions to the SDK they ship with.
pnpm --filter @epay/mobile fix

# 2. Configure endpoints.
cp apps/mobile/.env.example apps/mobile/.env.local

# 3. Run.
pnpm --filter @epay/mobile dev     # then press i / a, or scan the QR in Expo Go
```

`@epay/sdk` and `@epay/types` must be built before the app can resolve them:

```bash
pnpm --filter @epay/sdk build
pnpm --filter @epay/types build
```

## Testing

```bash
pnpm --filter @epay/mobile test
```

Unit tests cover the QR/URI parser (`src/lib/payment-payload.test.ts`). The
parser is deliberately free of React Native imports so it runs under plain
Vitest. Screens are exercised through the Playwright/Device Farm flows in
Phase 8 rather than snapshot-tested here.

## Design notes

- **Non-custodial by construction.** The app links a *public* key for balance
  display and payment matching; it never asks for or stores a secret key.
- **Fail closed.** When biometric hardware is missing or unenrolled, the payment
  action refuses rather than silently downgrading to no auth.
- **One client.** Every request goes through the shared `EPayClient`, so retry,
  timeout, and auth behaviour is identical across web, mobile, and extension.
