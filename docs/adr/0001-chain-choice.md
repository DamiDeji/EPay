# ADR 0001 — Target Stellar / Soroban for EPay

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** EPay maintainers
- **Supersedes:** the earlier TON ("The Open Network") + Acton prototype

## Context

EPay is a non-custodial payment gateway. An early prototype targeted **The Open Network
(TON)** using the **Acton** smart-contract toolkit. That prototype was abandoned, but the
chain identity lived on in two places that were never updated:

1. The GitHub repository "About" description, which still read _"built on The Open Network
   (TON) using the Acton smart contract development toolkit"_.
2. Local planning documents that referred to a "migration away from a prior TON prototype"
   (`docs/WAVE_APPEAL.md`).

Every line of actual code targets Stellar/Soroban, so the stale metadata was an outright
contradiction rather than a genuine second implementation.

### Evidence from the codebase

| Signal           | Location                                                      | Value                                                                 |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Contract runtime | `packages/contracts/Cargo.toml`                               | `soroban-sdk = "21.0.0"`, `soroban-token-sdk = "21.0.0"`              |
| Compile target   | `packages/contracts/package.json`, `.github/workflows/ci.yml` | `wasm32-unknown-unknown`                                              |
| Contract set     | `packages/contracts/contracts/*`                              | 12 Soroban (Rust) contracts                                           |
| Client SDK chain | `packages/sdk/package.json`                                   | `@stellar/stellar-sdk`                                                |
| Indexer source   | `apps/indexer`                                                | Stellar Horizon ledgers + Soroban contract events                     |
| Wallet model     | `packages/hooks/src/use-wallet.ts`, `packages/types`          | Freighter / xBull / Albedo / Rabet / Lobstr, `G...` ed25519 addresses |

There is no TON/Acton dependency, build step, or contract source anywhere in `main`.

## Decision

EPay targets **Stellar**, with on-chain logic written as **Soroban smart contracts (Rust)**.
TON and Acton are dropped from the project identity and documentation.

We choose Stellar/Soroban over TON because:

- **Settlement speed and cost fit the product.** 3–5 second finality and sub-cent fees make
  merchant point-of-sale and high-volume billing economically viable.
- **A built-in DEX/orderbook.** Merchants can accept one asset and settle in another without
  EPay operating its own liquidity or oracle for conversion.
- **A real wallet ecosystem.** Freighter, xBull, Albedo, Rabet, and Lobstr are already used
  by the target merchants and customers.
- **Soroban's resource metering.** Predictable, metered fees suit a payments product that
  must bound worst-case transaction cost.
- **Anchors and SEP standards.** SEP-24 on/off-ramps give a credible path to fiat, which TON
  does not offer as cleanly.

## Why Stellar/Soroban and not an EVM chain

The obvious alternative to Stellar is an EVM L2 (Base, Arbitrum, Optimism) or
Ethereum itself. It has more developers, more tooling, and more wallet
integrations. We still chose Stellar, for reasons specific to payments:

| Dimension                | Stellar/Soroban                         | EVM L2                                              | Why it decided the choice                                                             |
| ------------------------ | --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Settlement cost**      | sub-cent, deterministic                 | cents to dollars on L1, variable on L2              | High-volume billing and micropayments are only viable with sub-cent fees              |
| **Settlement time**      | 3–5s to finality                        | seconds on L2, but with L1 reorg risk in the window | Merchant point-of-sale needs near-instant, low-variance confirmation                  |
| **Asset conversion**     | protocol-level DEX/orderbook            | requires integrating a third-party AMM or oracle    | Merchants can accept one asset and settle in another without EPay operating liquidity |
| **Fee predictability**   | resource-metered, capped                | gas auctions, priority fees, spikes                 | A payment gateway must bound worst-case transaction cost                              |
| **Anchor/SEP standards** | SEP-24/31 give a real fiat path         | ramps are third-party and fragmented                | Regulatory and fiat off-ramps map to the target merchants                             |
| **Wallet ecosystem**     | Freighter, xBull, Albedo, Rabet, Lobstr | far larger (MetaMask, WalletConnect, …)             | **The one dimension the EVM wins**, and the main cost of this decision                |

None of these are absolute, and a payments product could be built on an L2. But
EPay's differentiators — merchant-grade settlement cost, speed, and built-in
conversion — are exactly the dimensions where Stellar is structurally better. The
EVM's advantage (developer and wallet breadth) is real and is paid for in higher
fees and harder fee prediction, which hits the product's core loop.

Because the choice is expensive to reverse, the trade-off is recorded here rather
than rediscovered later.

## Consequences

- All contracts, tests, indexing, SDK, and wallet integration remain Stellar/Soroban; no TON
  code is maintained and no cross-chain abstraction is introduced.
- The GitHub repository description and any README hero copy must describe Stellar/Soroban.
  This was the drift that motivated the ADR; keeping the two in sync is now an explicit
  review expectation ([CONTRIBUTING.md](../../CONTRIBUTING.md) PR checklist).
- Decisions that depend on the chain choice (custody model, upgrade pattern, asset support)
  get their own ADRs under `docs/adr/`.
- Reversing this decision would mean rewriting all 12 contracts, the SDK, and the indexer —
  treat it as effectively irreversible for the current architecture.
