# ADR 0002 — Non-custodial custody model

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** EPay maintainers
- **Related:** [ADR 0001 — Target Stellar / Soroban](./0001-chain-choice.md)

## Context

A payment gateway has to answer one question before any other: **who holds the
funds between the payer and the merchant?**

Three models were on the table:

1. **Custodial.** EPay operates a pooled wallet; merchants withdraw from EPay.
   Simplest UX, and what most Web2 processors do.
2. **Non-custodial, direct.** Funds move payer → merchant directly on Stellar.
   EPay orchestrates and indexes, but never has spending authority.
3. **Hybrid / smart-contract escrow.** Funds sit in a contract that neither party
   unilaterally controls, released by milestones or dispute resolution.

Custody drives almost everything else: the regulatory surface, the incident
blast radius, the key-management burden, and the failure modes during an outage.

## Decision

**Model 2 for direct payments, with model 3 available where the product needs
it (escrow and subscriptions).** EPay never takes custody of funds. The
`EscrowManager`, `SubscriptionManager`, and `RefundManager` contracts hold value
in escrow only for the lifetime of a specific agreement, and their release
conditions are enforced on-chain.

`TreasuryVault` and `FeeManager` hold *platform fees* only — never user
principal.

## Rationale

- **Regulatory.** Custody is the fact that triggers money-transmitter
  obligations in most jurisdictions. Not taking custody is what lets EPay ship
  to merchants without a money-services licence in every market.
- **Blast radius.** A compromised EPay server cannot move customer funds. The
  worst case is data exposure and service disruption, not theft.
- **Incident recovery.** EPay can lose its database and rebuild the read-model
  from the chain (see [`disaster-recovery.md`](../disaster-recovery.md)). That is
  only true because the chain, not the database, holds the authoritative balance.
- **Trust story.** Merchants can verify on-chain that settlements match invoices
  without trusting EPay's accounting.

## Consequences

**Accepted costs:**

- **Wallet UX burden transfers to users.** Merchants and payers must hold their
  own keys. A lost key is an unrecoverable loss, and EPay cannot reverse a
  mistaken payment. Docs must say this plainly.
- **No gasless/abstracted payments out of the box.** Users pay their own
  Stellar fees. Fee sponsorship would require an explicit relayer design and a
  new funding model.
- **Refunds are constrained.** The refund window and maximum are enforced by
  contract logic plus the merchant's own balance — EPay cannot claw back funds
  from a merchant's wallet.
- **Key-management guidance is part of the product.** The onboarding flow, the
  mobile app, and the SDK all have to teach safe key handling.

**Follow-on decisions this forces:**

- The auth model must be wallet-signature based alongside passwords
  ([ADR 0003](./0003-auth-model.md)).
- The mobile app is deliberately watch-and-pay, never hold-a-key.
- Contract upgrade paths need a timelock, because a malicious upgrade *would*
  grant spending authority ([ADR 0004](./0004-upgrade-pattern.md)).

## Rejected alternatives

- **Custodial pooled wallet.** Rejected: licence burden, single point of theft,
  destroys the "verify your own settlement" property, and makes the product
  indistinguishable from a Stripe-clone with a blockchain backend.
- **Fully custodial with per-merchant wallets.** Better isolation, but the
  operator still controls spend authority, so it carries the same regulatory
  consequence with more operational complexity.
- **Escrow-everything.** Rejected: putting every payment through escrow doubles
  settlement latency and gas for the common case where the merchant is trusted.
  Escrow is opt-in per agreement.
