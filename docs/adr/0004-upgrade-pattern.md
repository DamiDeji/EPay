# ADR 0004 — Contract upgrade and admin pattern

- **Status:** Accepted
- **Date:** 2026-09-11
- **Related:** [ADR 0002 — Non-custodial custody model](./0002-custody-model.md)

## Context

Soroban contracts are upgradeable: the admin can replace the WASM behind a
deployed contract address while the address, and therefore every integration
pointing at it, stays the same.

That is a sharp tool. In a **non-custodial** system ([ADR 0002](./0002-custody-model.md))
the admin key is not merely a configuration privilege — a malicious or coerced
upgrade of `EscrowManager`, `RefundManager`, `TreasuryVault`, or `FeeManager`
could redirect funds. Whoever holds the admin key can, in principle, take
custody. The upgrade mechanism is therefore part of the trust model, not an
operational detail.

State at the time of this decision: admin transfers were **single-step** and
upgrades were **instant**, executed by the same call that proposed them.

## Decision

Three changes, applied consistently across all 12 contracts:

### 1. Two-step admin transfer

```
transfer_admin(new_admin)   // pending_admin = new_admin, emit AdminTransferProposed
accept_admin()              // caller must be pending_admin → admin = pending_admin
```

No ownership change takes effect until the _recipient_ accepts. A typo in the
new admin address cannot strand a contract, and a compromised admin key cannot
silently hand control to an attacker who never has to prove control of the target.

### 2. Timelocked upgrades

```
propose_upgrade(new_wasm_hash)   // records hash + executable_at = now + delay
execute_upgrade()                // caller is admin AND now >= executable_at
cancel_upgrade()                 // admin aborts a proposal
```

The delay is a contract parameter with a floor (72 hours recommended) that
cannot be set below the floor in a single call, so the delay cannot be dropped
to zero and used immediately.

### 3. Circuit breaker

`pause_contract` / `unpause_contract` (extending the existing `EmergencyPause`
surface) halt value movement without requiring an upgrade. Pausing is _fast_ and
_reversible_; upgrading is slow and irreversible. Separating them means the
emergency response to an exploit is a pause, not a rushed upgrade.

## Rationale

- **The timelock is the users' exit.** During the 72-hour window, a merchant or
  integrator can see the proposed WASM hash, verify it, and withdraw from escrow
  if they do not accept it. Without a timelock there is no exit.
- **Two-step transfer removes a class of destructive typo.** Single-step admin
  transfer with no confirmation is a well-known way to permanently brick a
  contract.
- **A pause is a better emergency lever than an upgrade.** Pausing is one
  transaction, observable, and undone in seconds. An upgrade during an incident
  is exactly the moment when review quality is lowest.
- **Consistency beats cleverness.** Twelve contracts with three subtly different
  admin patterns is twelve chances to get it wrong.

## Consequences

- **Upgrades are no longer a single transaction.** Operational runbooks must
  account for a 72-hour window; a critical bugfix cannot be deployed instantly.
  The pause mechanism is the answer for the interim.
- **Admin key management becomes the highest-value secret in the system.**
  Self-hosting a contract means the admin key should live in a hardware wallet
  or a multisig, never in CI. This is now a documented operational requirement.
- **`propose_upgrade` emits an event** and appears in the indexer, so an upgrade
  proposal is observable by anyone, including via the admin dashboard.
- **Tests must cover the negative paths**: `execute_upgrade` before the delay,
  `accept_admin` from a non-pending address, `cancel_upgrade` by a non-admin, and
  value movement while paused.
- **Migration cost.** Existing deployments keep the old admin until a two-step
  transfer is performed; this is a one-time operational step per contract,
  recorded in `DEPLOYMENTS.md`.

## Rejected alternatives

- **Immutable contracts (no upgrade path).** Safest trust model, but it makes any
  bug permanent and requires a migration contract plus integrator coordination
  for every fix. Rejected as premature for a system still pre-audit, but worth
  revisiting once the contracts are stable and audited.
- **Instant upgrade with an event.** Rejected: an event is a notification, not an
  exit. It does not give users time to react.
- **Multisig admin instead of a timelock.** Valuable but orthogonal — a multisig
  reduces the chance of a bad proposal; a timelock bounds the damage if one
  passes anyway. We want both, and the timelock is the part that lives in the
  contract.
- **48-hour delay.** Rejected as too tight for a coordinated response across
  merchants in different time zones; 72 hours keeps a full business day on each
  side of a weekend.
