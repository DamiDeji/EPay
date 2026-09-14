# Smart Contract Security

This document covers the on-chain half of EPay: the ownership model, how upgrades
and pauses work, and what the contracts assume about the world. The repository-wide
vulnerability disclosure policy and response SLA live in
[`/SECURITY.md`](../../SECURITY.md); read that first if you are reporting a bug.

Scope: everything under `packages/contracts/`. The API, SDK, indexer, and
dashboards are covered by the root [`SECURITY.md`](../../SECURITY.md).

## Admin & ownership model

Every contract stores a single owner (an `Address`) in **instance storage** under
the `owner` symbol, set exactly once by `init`. `init` panics with
`Already initialized` if called again, so ownership cannot be re-seeded by a
second initialisation.

| Contract               | Owner powers                                                  | Additional roles                                    |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `PaymentRouter`        | `refund_payment`; `init` wiring of fee/pause/config addresses | payer & merchant authorise their own transitions    |
| `InvoiceManager`       | `mark_overdue`                                                | merchant creates/issues; customer pays              |
| `EscrowManager`        | `complete`, `resolve_dispute`, `refund_escrow`                | customer funds; merchant/customer dispute           |
| `RefundManager`        | approve / complete / reject refunds                           | payer or merchant requests                          |
| `SubscriptionManager`  | none beyond `init`                                            | customer creates/cancels; `renew` is permissionless |
| `SettlementManager`    | `create_settlement`, `process_settlement`                     | —                                                   |
| `MerchantRegistry`     | suspend / reactivate                                          | registered verifiers verify                         |
| `TreasuryVault`        | deposit / withdraw / record — **all writes**                  | depositor authorises `deposit`                      |
| `FeeManager`           | set default and per-merchant fees                             | —                                                   |
| `ConfigurationManager` | `update_config`                                               | —                                                   |
| `EmergencyPause`       | pause / unpause                                               | —                                                   |
| `RoleManager`          | assign / revoke roles                                         | —                                                   |
| `UpgradeManager`       | transfers admin, proposes/executes upgrades                   | proposed admin must accept                          |
| `PriceOracle`          | add / remove oracles                                          | authorised oracles write prices                     |
| `Governance`           | set quorum, cancel                                            | token holders vote                                  |
| `ImpactNFT`            | badging definitions & issuance                                | issuer revokes                                      |

### Admin transfer is two-step

Admin handover is **propose → accept**, never a single call
(`UpgradeManager::transfer_admin` then `accept_admin`):

1. The current admin calls `transfer_admin(new_admin)`, which stores a
   `AdminTransferState::Pending { new_admin, proposed_by, proposed_at }` and emits
   `admin_transfer_proposed`. **Nothing about the current admin changes.**
2. The _proposed_ address calls `accept_admin` from its own transaction. Only then
   is `owner` rewritten and `admin_transfer_completed` emitted.
3. Either side can walk away: the current admin can call `cancel_admin_transfer`.

This removes the single most common governance bug — a transfer to a
mis-typed or unreachable address — because a wrong address can never complete the
handover on its own. Transfers to the zero address are rejected outright.

## Upgrade mechanism

Contracts are upgradeable, and the path is **timelocked**
(`UpgradeManager`, implementing [ADR 0004](../../docs/adr/0004-upgrade-pattern.md)):

| Step        | Call                                              | Constraint                                                                                  |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. Propose  | `propose_upgrade(caller, wasm_hash, description)` | admin only; `wasm_hash` must be exactly 32 bytes (SHA-256); returns a proposal id           |
| 2. Wait     | —                                                 | **72 hours** (`MIN_TIMELOCK_SECONDS = 259 200`) between proposal and the earliest execution |
| 3. Execute  | `execute_upgrade(caller, id)`                     | admin only; panics with `Upgrade timelock has not expired` before `executable_at`           |
| — or cancel | `cancel_upgrade(caller, id)`                      | admin only; removes the proposal                                                            |

Why 72 hours: it is long enough for users and integrators to read the proposed
hash, verify the WASM off-chain, and exit positions they are not comfortable
leaving in the hands of the new code — and short enough that a genuine security
fix is not blocked over a weekend. The timelock is a **lower bound**, not a
schedule; a proposal sits indefinitely until executed or cancelled.

`get_pending_proposals()` lets anyone enumerate what is currently proposed, so the
72-hour window is observable, not just theoretical.

> **Operational note.** `propose_upgrade` records the hash in the manager. The
> actual `update_current_contract_wasm` call for a given contract is a separate
> Stellar operation; the manager's role is to enforce that no upgrade can be
> _authorised_ inside the window. See the deployment runbook for the pairing.

## Pause & emergency behaviour

`EmergencyPause` is a dedicated circuit breaker stored as a single boolean:

- `pause(caller, reason)` and `unpause(caller)` are owner-only; both emit an event
  (`paused` / `unpaused`) carrying the reason.
- Downstream contracts consult it before moving value. The contract-side helper is
  `require_not_paused()`, which panics when the breaker is engaged, so a paused
  platform rejects value movement at the contract boundary rather than relying on
  the API to remember to check.
- Pausing does **not** upgrade code, change ownership, or touch stored balances.
  Un-pausing restores the prior behaviour exactly.
- The admin dashboard exposes the same action; both paths are audit-logged
  off-chain and produce an on-chain event.

The intended response to a suspected contract exploit is: **pause first, then
investigate.** Pausing is cheap and reversible; a bad upgrade is not.

## Reentrancy

Soroban's execution model does not allow the classic EVM reentrancy pattern
(a token contract cannot call back into the caller mid-transfer in the same way),
but the contracts still follow **checks → effects → interactions**:

1. Validate caller authorisation and state preconditions.
2. Write the new state.
3. Perform the token transfer last.

So even if a token `transfer` reverted or re-entered, the recorded state is already
consistent and the call fails atomically.

## Integer arithmetic

All amounts are `i128` stroops. Soroban's `soroban-sdk` uses checked arithmetic and
panics on overflow rather than wrapping, and the contracts additionally validate
bounds (fee ≤ 500 bps, refund ≤ original amount, withdrawal ≤ balance) before any
subtraction. There is no unchecked `as` cast between integer widths on the money
path.

## Authorisation checklist

Every public function that mutates storage satisfies one of:

- `caller.require_auth()` plus a comparison against the stored owner, or
- a named actor recorded on the entity (payer, merchant, customer, issuer), or
- an explicit `require_admin`-style helper.

Read-only functions (`get_*`, `*_exists`, `is_*`, `has_*`, `calculate_*`) require
no authorisation and never mutate state. Query functions are safe to call from the
indexer.

## What the contracts do _not_ do (non-goals)

- **No custody.** The contracts hold tokens only for the duration of an escrow;
  they never hold private keys and cannot move a user's funds outside the
  authorised paths ([ADR 0002](../../docs/adr/0002-custody-model.md)).
- **No oracles for the money path (yet).** `PaymentRouter` settles in the asset it
  was given. `PriceOracle` exists but is not wired into a v1 payment.
- **No upgrade of storage layouts.** An upgrade may change code; callers must
  treat stored record shapes as append-only and version them explicitly if they
  change.

## Internal review status

| Area                                           | Status                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Authorisation on every mutating entry point    | ✅ Reviewed                                                                                        |
| Two-step admin transfer                        | ✅ Implemented (`UpgradeManager`)                                                                  |
| Timelocked upgrades (72h)                      | ✅ Implemented (`UpgradeManager`)                                                                  |
| Emergency pause + `require_not_paused`         | ✅ Implemented (`EmergencyPause`)                                                                  |
| Overflow-safe arithmetic                       | ✅ Reviewed (checked `i128`, explicit bounds)                                                      |
| Event on every state change                    | ✅ Catalogued in [EVENTS.md](./EVENTS.md)                                                          |
| Property/fuzz tests on funds-at-risk contracts | ✅ `TreasuryVault`, `EscrowManager`, `RefundManager`, `SettlementManager` (10 000 iterations each) |
| **Third-party audit**                          | 🔜 **Not yet performed** — blocking for mainnet, funded in the SCF Wave 8 application              |

The audit will be scoped to the funds-at-risk tier first:
`EscrowManager`, `RefundManager`, `TreasuryVault`, `PaymentRouter`, `FeeManager`.

## Reporting

Do not open a public issue. Use GitHub Security Advisories
(**[github.com/DamiDeji/EPay/security/advisories/new](https://github.com/DamiDeji/EPay/security/advisories/new)**)
or `security@epay.dev`. Acknowledgements target **48 hours**; critical
funds-at-risk fixes target **30 days**. Full detail in
[`/SECURITY.md`](../../SECURITY.md).
