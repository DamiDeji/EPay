# ADR 0005 — Split functionality across discrete contracts

- **Status:** Accepted
- **Date:** 2026-09-14
- **Deciders:** EPay maintainers
- **Related:** [ADR 0002](./0002-custody-model.md) (custody), [ADR 0004](./0004-upgrade-pattern.md) (upgrade pattern)

## Context

EPay's on-chain logic covers payments, invoices, escrow, refunds, subscriptions,
settlements, merchant onboarding, treasury accounting, fees, configuration, RBAC,
and an emergency pause. Every contract is upgraded through the same
[timelocked path](./0004-upgrade-pattern.md), and all of them need an audit before
mainnet.

Two structures were viable:

1. **A monolith** — one contract with a function per operation and a shared
   storage namespace.
2. **Discrete contracts** — one contract per responsibility, wired together by
   addresses passed at `init` time.

The forces that mattered: the audit is the single largest cost and the single
biggest external dependency; value is concentrated in a few operations; and the
team is small enough that review quality, not throughput, is the constraint.

## Decision

EPay uses **one contract per responsibility**. Sixteen contracts ship today
(twelve payment primitives plus upgrade, oracle, governance, and NFT extensions),
grouped into trust tiers in
[`packages/contracts/README.md`](../../packages/contracts/README.md#trust-tiers).

### Why

- **Bounded blast radius.** A monolith holds every fund in one storage namespace;
  a bug in invoice-issued accounting can corrupt escrow balances. Split contracts
  mean a funds bug is confined to the funds contract, and the audit can reason
  about each contract's storage independently.
- **Auditable, scoped upgrades.** The upgrade timelock is only meaningful if the
  thing behind it is small enough to review in the window. Replacing a 2,000-line
  contract means re-verifying payment routing, escrow, and treasury at once;
  replacing `FeeManager` means reading one file. Scope the change, scope the risk.
- **Independent pause and fee caps.** `EmergencyPause` halts value movement
  without touching configuration; `FeeManager`'s 500-bps cap is enforced in one
  place and cannot be bypassed by another contract's fee logic.
- **Parallel work and review.** Contributors can own one contract. A monolith
  forces every change through one file and one reviewer.
- **Matches the domain.** Payments, escrow, subscriptions, and refunds are
  genuinely separate lifecycles with separate state machines. Encoding that in the
  contract split makes the boundaries explicit instead of implicit in storage keys.

### Alternatives considered

**Monolithic contract.** Rejected. Cheaper to deploy and to wire (no cross-contract
calls, no address plumbing), and a single storage namespace removes a class of
inconsistency bug. But it makes every audit cover everything, makes the pause
switch a blunt global instrument, and makes storage-layout migration on upgrade
all-or-nothing. For a system that must survive an audit and be upgraded under a
timelock, those are disqualifying.

**One contract per *operation*** (e.g. `CreatePayment`, `ConfirmPayment`).
Rejected. It fragments state ownership: `ConfirmPayment` would have to write
storage it does not own, and the payment lifecycle would be spread across
contracts with no single invariant owner.

**Shared library crate, single deployed contract.** Rejected for the same reason as
the monolith — the library helps the *developer*, not the *blast radius*; all code
still ships as one deployable unit.

## Consequences

- **Cross-contract calls on some paths** (e.g. routing a payment consults
  `FeeManager` and `EmergencyPause`). This costs a little CPU and adds a failure
  mode: a mis-wired address at `init` is a deployment bug. Mitigated by wiring
  addresses in `init` (immutable afterwards) and verifying them in the deployment
  runbook.
- **Address management is real work.** Each contract stores the addresses it
  needs; there is no registry to look them up. [`DEPLOYMENTS.md`](../../DEPLOYMENTS.md)
  is the source of truth and must be updated with every deployment.
- **Sixteen deployments to track**, each with its own admin and upgrade history.
- **No shared storage.** A contract cannot read another's storage directly; state
  that must be shared is either duplicated deliberately or passed as a call.
- **Reversing this** means redeploying everything and migrating all recorded state
  — treat it as effectively irreversible, as with [ADR 0001](./0001-chain-choice.md).
