# ADR 0003 — Authentication model

- **Status:** Accepted
- **Date:** 2026-09-11
- **Related:** [ADR 0002 — Non-custodial custody model](./0002-custody-model.md)

## Context

EPay serves two very different clients:

- **Humans** in the three dashboards and the mobile app, who need sessions,
  recovery, and something they can remember.
- **Machines** — merchant backends calling the REST API, and webhook receivers
  verifying our calls.

Because EPay is non-custodial ([ADR 0002](./0002-custody-model.md)), there is no
"move money" endpoint to protect: the API authorizes *record-keeping and
configuration*, not transfers. That reframes what authentication has to achieve.
It is a **data-access and command** boundary, not a funds boundary.

## Decision

Three credential types, each scoped to its client:

| Client | Credential | Lifetime | Notes |
| --- | --- | --- | --- |
| Dashboard / mobile | **JWT access + refresh** | 15m access, 7d refresh | Role claims (`ADMIN`, `MERCHANT`, `CUSTOMER`, `DEVELOPER`) |
| Dashboard / mobile (alt) | **Stellar wallet signature** | Per-session challenge | Nonce-based; proves key ownership |
| Merchant backend | **API key** (`x-api-key`) | Long-lived, revocable, scoped | `ApiPermission` per key |

Supporting controls:

- **Role-based guards** (`JwtAuthGuard` plus role decorators) on every
  state-mutating endpoint.
- **Rate limiting** applied globally via a `ThrottlerGuard` registered as an
  `APP_GUARD`, so new modules are protected by default rather than by remembering.
- **Idempotency keys** on payment-creating endpoints, so a retried request cannot
  double-record a payment.
- **Audit log** entries for privileged actions.

## Rationale

- **Two audiences, two ergonomics.** A 15-minute JWT is wrong for a merchant's
  cron job; a long-lived API key is unacceptable for a browser session. Splitting
  them keeps both usable without compromise.
- **Wallet auth matches the product.** Users already have Stellar wallets
  ([ADR 0001](./0001-chain-choice.md)); letting them authenticate with the key
  they already hold removes a password without inventing an SSO dependency.
- **Nonces prevent replay.** A signature over a timestamped, server-issued
  nonce cannot be replayed across sessions, which a signature over a static
  message could be.
- **Short access tokens bound the damage** of a leaked token while long refresh
  tokens keep the UX tolerable.

## Consequences

- **Refresh-token storage becomes security-critical.** It lives in
  `expo-secure-store` on mobile (Keychain / EncryptedSharedPreferences) and in an
  httpOnly cookie on web. It must never be written to `localStorage` or
  AsyncStorage.
- **Revocation is not instant for JWTs.** A leaked access token is valid until it
  expires. Mitigations: 15-minute lifetime and rotating `JWT_SECRET` as a blunt
  global logout (documented in
  [`disaster-recovery.md`](../disaster-recovery.md)).
- **API keys need a rotation story.** Keys are scoped and revocable, and the
  onboarding flow issues one per integration rather than per merchant.
- **Wallet auth needs a nonce store.** Nonces are single-use and expiring, so a
  Redis dependency is required for that flow.
- **CSRF is largely a non-issue for the API** (bearer tokens in headers, not
  cookies), but cookie-backed dashboard sessions still need CSRF protection on
  state-changing form posts, and `SameSite` + origin checks are the first line.

## Rejected alternatives

- **Passwords only.** Rejected: excludes wallet-native users and adds a
  credential-stuffing surface for a product whose users already hold keys.
- **OAuth/social login.** Deferred: adds an identity provider dependency and an
  account-linking problem without addressing the wallet-native path.
- **Long-lived JWTs.** Rejected: unbounded blast radius, and it makes revocation
  impossible without a server-side denylist.
- **Signing every request with the wallet key.** Rejected: unusable for machine
  clients, and it forces a signing prompt for read-only calls.
