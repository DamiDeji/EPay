# @epay/extension

A Manifest V3 browser extension (Chrome + Firefox) that detects Stellar public
keys on any page you visit and offers a one-click **Pay with EPay** action.

## What it does

1. A content script scans the rendered text of each page for Stellar accounts
   (`G` + 55 base32 characters) and reports them to the service worker.
2. The service worker tracks how many were found and sets the toolbar badge.
3. The popup lists the detected addresses, lets you pick one, optionally enters
   an amount and asset, and opens EPay's hosted checkout with the details
   prefilled.
4. Wallet connection reuses the shared `useWallet` hook from `@epay/hooks`, so
   the wallet-connect flow is identical to the web dashboards.

## Build

```bash
pnpm --filter @epay/extension build            # Chrome MV3 → dist/
pnpm --filter @epay/extension build:firefox    # Firefox MV3 → dist/
pnpm --filter @epay/extension dev              # watch build
```

Load `apps/extension/dist` via `chrome://extensions` → _Load unpacked_, or
`about:debugging` → _Load Temporary Add-on_ in Firefox.

`@epay/sdk` and `@epay/hooks` must be built first:

```bash
pnpm --filter @epay/sdk build
pnpm --filter @epay/hooks build
```

## Permissions (least privilege)

| Permission  | Why it is needed                                                               |
| ----------- | ------------------------------------------------------------------------------ |
| `storage`   | Persist the configured API/web URLs between popup and service-worker restarts. |
| `activeTab` | Read the current tab to query the content script for detected addresses.       |

`host_permissions` are limited to Horizon, Soroban RPC, and the EPay API. The
extension requests no browsing-history, `webRequest`, or `<all_urls>` host
access; the content script matches `<all_urls>` for _injection_ only and makes no
network requests of its own.

## Tests

```bash
pnpm --filter @epay/extension test
```

`src/lib/detect.test.ts` covers address detection, ordering, dedupe, and URI
construction. Detection logic lives in `src/lib/detect.ts` with no DOM or
extension imports specifically so it can be tested under plain Vitest.

## Firefox differences

`manifest.firefox.json` differs from the Chrome manifest in exactly two ways:
the background worker is declared as an event page
(`background.scripts`) rather than a service worker, and it carries the
`browser_specific_settings.gecko.id` extension identity.

## Notes

- Icons are intentionally not declared: Chrome and Firefox use a generated
  placeholder until the brand PNGs are added under `apps/extension/icons/`.
- The extension is a _thin_ surface. It never holds keys and never talks to
  Soroban directly — it hands off to the hosted EPay checkout.
