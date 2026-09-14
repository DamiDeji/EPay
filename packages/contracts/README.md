# EPay Soroban Contracts

The on-chain half of EPay: **16 Soroban smart contracts written in Rust**, compiled
to WASM for the Stellar network. Twelve are core payment primitives (enumerated in
the [root README](../../README.md)); four extend the system — `UpgradeManager`,
`PriceOracle`, `Governance`, and `ImpactNFT` — and are documented here too.

Every contract follows the same mental model:

- **Instance storage** holds configuration and the owner/admin address.
- **Persistent storage** holds the entity records (payments, escrows, refunds, …).
- Every state-mutating function **authorises the caller** before touching storage.
- Every state change **publishes an event** for the indexer to pick up.
- Value-moving contracts (`EscrowManager`, `RefundManager`, `TreasuryVault`,
  `PaymentRouter`) hold no private keys and are **non-custodial by construction**
  ([ADR 0002](../../docs/adr/0002-custody-model.md)).

The complete event catalogue lives in [EVENTS.md](./EVENTS.md). The cross-contract
threat model, ownership rules, upgrade path, and pause semantics live in
[SECURITY.md](./SECURITY.md).

## Layout

```text
packages/contracts/
├── Cargo.toml            # workspace: 16 members
├── contracts/<name>/
│   ├── Cargo.toml        # soroban-sdk 21 + testutils (dev)
│   └── src/
│       ├── lib.rs        # contract
│       └── test.rs       # unit + fuzz tests
├── EVENTS.md             # every emitted event, per contract
└── SECURITY.md           # admin model, upgrades, pause
```

## Build and test

```bash
# Unit tests for all contracts
cargo test --manifest-path packages/contracts/Cargo.toml

# Just one contract
cargo test --manifest-path packages/contracts/contracts/treasury-vault/Cargo.toml

# Lint (CI treats warnings as errors)
cargo clippy --manifest-path packages/contracts/Cargo.toml -- -D warnings

# Production WASM
cargo build --manifest-path packages/contracts/Cargo.toml \
  --target wasm32-unknown-unknown --release
```

Rust **1.89+** is required (`rust-version` in the workspace manifest).

## Trust tiers

Grouping the contracts by how much damage a bug can do makes review effort
proportional to risk, and matches how the audit is scoped in
[SECURITY.md](./SECURITY.md).

| Tier                | Contracts                                                                        | Why                                                                 |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Funds-at-risk**   | `EscrowManager`, `RefundManager`, `TreasuryVault`, `PaymentRouter`, `FeeManager` | Move or account for real token balances                             |
| **State-integrity** | `InvoiceManager`, `SubscriptionManager`, `SettlementManager`, `MerchantRegistry` | Authoritative business records; wrong state means wrong money later |
| **Control-plane**   | `UpgradeManager`, `EmergencyPause`, `RoleManager`, `ConfigurationManager`        | Can halt or reconfigure everything else                             |
| **Extension**       | `PriceOracle`, `Governance`, `ImpactNFT`                                         | Newer; not on the money path for a v1 merchant                      |

---

## PaymentRouter

Routes and records a payment through its lifecycle: `created → confirmed →
completed`, with `failed` and `refunded` terminal states.

- **Entry points (write):** `init(owner, token, fee_manager, config, pause)` ·
  `create_payment(...)` · `confirm_payment(caller, id, tx_hash)` ·
  `complete_payment(caller, id)` · `fail_payment(caller, id)` ·
  `refund_payment(admin, id)`
- **Entry points (read):** `get_payment(id)` · `payment_exists(id)` ·
  `get_next_id()` · `get_payment_count()` · `get_token_address()`
- **Access control:** the payer/merchant authorise `create`/`confirm`;
  `complete` and `fail` are gated on the recorded actor; `refund` is admin-only.
- **Invariants:** a payment is only `completed` from `confirmed`; the fee charged
  never exceeds the configured maximum (500 bps); the `FeeManager` and
  `EmergencyPause` addresses are immutable after `init`.
- **Emits:** `payment_created`, `payment_confirmed`, `payment_completed`,
  `fee_collected`, `payment_failed`, `payment_refunded`.

## InvoiceManager

Invoice lifecycle: `draft → issued → paid`, with `cancelled` and `overdue` as
alternate terminals.

- **Entry points (write):** `init(owner)` · `create_invoice(...)` ·
  `issue_invoice(id)` · `pay_invoice(id, payment_id)` · `cancel_invoice(id)` ·
  `mark_overdue(id)`
- **Entry points (read):** `get_invoice(id)` · `invoice_exists(id)`
- **Access control:** creation is merchant-authorised; `mark_overdue` is
  owner-gated; payment must reference an existing payment.
- **Invariants:** an invoice cannot be paid twice; `paid` is terminal; an invoice
  cannot be cancelled after it is paid.
- **Emits:** `invoice_created`, `invoice_issued`, `invoice_paid`,
  `invoice_cancelled`.

## EscrowManager

Multi-milestone escrow with an explicit dispute path. Funds are held by the
contract, not by EPay.

- **Entry points (write):** `init(owner, token_address)` ·
  `create_escrow(merchant, customer, amount, milestones, deadline)` ·
  `fund_escrow(customer, id)` · `complete_escrow(admin, id)` ·
  `dispute_escrow(disputer, id, reason)` · `resolve_dispute(admin, id)` ·
  `cancel_escrow(caller, id)` · `refund_escrow(admin, id)`
- **Entry points (read):** `get_escrow(id)` · `escrow_exists(id)` ·
  `get_token_address()`
- **Access control:** only the named customer can fund; only the merchant or
  customer can dispute; release, refund, and dispute resolution are admin-gated.
- **Invariants:** a milestone sum can never exceed the escrow amount; funds can
  only leave through `complete_escrow` (to merchant) or `refund_escrow` (to
  customer); a disputed escrow cannot be released until resolved; `cancelled`
  requires the escrow to be unfunded.
- **Emits:** `escrow_created`, `escrow_funded`, `escrow_completed`,
  `escrow_disputed`, `escrow_resolved`, `escrow_cancelled`, `escrow_refunded`.
- **Fuzz-tested** — see the `fuzz` module in `src/test.rs`.

## RefundManager

Full and partial refunds against an existing payment.

- **Entry points (write):** `init(owner, token_address)` ·
  `request_refund(...)` · `approve_refund(admin, id)` · `complete_refund(admin, id)` ·
  `reject_refund(admin, id)`
- **Entry points (read):** `get_refund(id)` · `refund_exists(id)` ·
  `get_token_address()`
- **Access control:** requests must come from the original payer or merchant;
  approval, completion, and rejection are admin-only.
- **Invariants:** `amount ≤ original_amount`; the sum of completed refunds for a
  payment never exceeds `original_amount`; a refund is only `completed` from
  `approved`; terminal states are immutable.
- **Emits:** `refund_requested`, `refund_approved`, `refund_completed`,
  `refund_rejected`.
- **Fuzz-tested** — see the `fuzz` module in `src/test.rs`.

## SubscriptionManager

Recurring billing: `create → renew` on an interval, with `pause`/`cancel`.

- **Entry points (write):** `init(owner)` · `create_subscription(...)` ·
  `renew(id)` · `pause(id)` · `cancel(id)`
- **Entry points (read):** `get_subscription(id)` · `subscription_exists(id)`
- **Access control:** creation and cancellation are customer-authorised; `renew`
  is permissionless (it cannot move funds to an unapproved destination).
- **Invariants:** `renew` is rejected unless `now ≥ next_billing_date`; a paused
  or cancelled subscription cannot be renewed; `payments_made` never exceeds
  `max_payments` when set.
- **Emits:** `sub_created`, `sub_renewed`, `sub_paused`, `sub_cancelled`.

## SettlementManager

Batches completed payments into a periodic settlement with a fee/net split.

- **Entry points (write):** `init(owner)` · `create_settlement(...)` ·
  `process_settlement(id)`
- **Entry points (read):** `get_settlement(id)`
- **Access control:** `create_settlement` is owner-gated; `process_settlement`
  transitions the record.
- **Invariants:** `net_amount = amount − fee_amount` and `fee_amount ≤ amount`;
  a settlement is processed at most once; `PENDING → PROCESSING → COMPLETED`.
- **Emits:** `settlement_created`, `settlement_done`.
- **Fuzz-tested** — see the `fuzz` module in `src/test.rs`.

## MerchantRegistry

Merchant onboarding, verification, suspension, and reactivation.

- **Entry points (write):** `init(owner)` · `register_merchant(...)` ·
  `verify_merchant(verifier, id)` · `suspend_merchant(admin, id)` ·
  `reactivate_merchant(admin, id)`
- **Entry points (read):** `get_merchant(id)` · `get_merchant_by_address(addr)` ·
  `is_merchant(addr)` · `is_merchant_active(addr)`
- **Access control:** registration is self-authorised; verification requires a
  registered verifier; suspension/reactivation are admin-only.
- **Invariants:** one active merchant per address; only an `ACTIVE` merchant
  passes `is_merchant_active`; a suspended merchant cannot be verified without
  reactivation.
- **Emits:** `merchant_reg`, `merchant_verified`, `merchant_suspended`,
  `merchant_react`.

## TreasuryVault

Treasury accounting and fee collection against a single Stellar asset.

- **Entry points (write):** `init(owner, token_address)` ·
  `deposit(owner, from, amount, asset_code)` ·
  `withdraw(owner, to, amount, asset_code)` ·
  `record_tx(owner, tx_type, amount, asset_code, reference_id)`
- **Entry points (read):** `get_transaction(id)` · `get_token_address()` ·
  `get_tx_count()`
- **Access control:** every write requires the owner; `deposit` additionally
  requires the depositor's authorisation.
- **Invariants:** a withdrawal can never exceed the vault's token balance (the
  token transfer reverts); `tx_count` is monotonic; every movement writes a
  `TreasuryTx` record.
- **Emits:** `treasury_deposit`, `treasury_withdraw`, `treasury_tx_recorded`.
- **Fuzz-tested** — see the `fuzz` module in `src/test.rs`.

## FeeManager

Platform-wide fee configuration and per-merchant overrides, in basis points.

- **Entry points (write):** `init(owner, default_fee_bps)` ·
  `set_default_fee(caller, fee_bps)` · `set_merchant_fee(caller, merchant, fee_bps)`
- **Entry points (read):** `get_config()` · `calculate_fee(amount, merchant)`
- **Access control:** both setters are owner-only.
- **Invariants:** every fee is `≤ MAX_FEE_BPS` (500 bps = 5%); a per-merchant fee
  overrides the default but is itself capped; `calculate_fee` never returns more
  than 5% of the amount.
- **Emits:** none (configuration only) — changes are read back via `get_config`.

## ConfigurationManager

Platform-wide switches, including maintenance mode.

- **Entry points (write):** `init(owner)` · `update_config(admin, new_config)`
- **Entry points (read):** `get_config()` · `is_maintenance_mode()`
- **Access control:** `update_config` is admin-only.
- **Invariants:** the config struct is written atomically; maintenance mode is a
  read-only projection of the stored config.
- **Emits:** `config_updated`.

## EmergencyPause

The circuit breaker. Other contracts consult it before moving value.

- **Entry points (write):** `init(owner)` · `pause(caller, reason)` · `unpause(caller)`
- **Entry points (read):** `is_paused()` · `require_not_paused()` (panics when paused)
- **Access control:** `pause` and `unpause` are owner-only.
- **Invariants:** pause state is a single boolean; `require_not_paused` is the
  only safe way downstream contracts should gate value movement.
- **Emits:** `paused`, `unpaused`.
- **See also:** [SECURITY.md § Pause & emergency behaviour](./SECURITY.md#pause--emergency-behaviour).

## RoleManager

Role-based access control over a fixed `Role` enum.

- **Entry points (write):** `init(owner)` · `assign_role(admin, target, role)` ·
  `revoke_role(admin, target, role)`
- **Entry points (read):** `has_role(address, role)`
- **Access control:** assignment and revocation are admin-only.
- **Invariants:** roles are additive per `(address, role)` pair; revocation is
  idempotent.
- **Emits:** `role_assigned`, `role_revoked`.

## UpgradeManager

Control plane for admin identity and contract upgrades. Implements
[ADR 0004](../../docs/adr/0004-upgrade-pattern.md).

- **Entry points (write):** `init(owner)` · `transfer_admin(caller, new_admin)` ·
  `accept_admin(caller)` · `cancel_admin_transfer(caller)` ·
  `propose_upgrade(caller, wasm_hash, description)` · `execute_upgrade(caller, id)` ·
  `cancel_upgrade(caller, id)`
- **Entry points (read):** `get_admin()` · `is_admin(caller)` ·
  `get_upgrade_proposal(id)` · `get_pending_proposals()` ·
  `has_pending_admin_transfer()` · `get_pending_admin()`
- **Access control:** the current admin proposes; the **proposed** admin must
  accept (two-step). Upgrades are admin-proposed and gated by a **72-hour
  timelock** before execution.
- **Invariants:** a WASM hash must be exactly 32 bytes (SHA-256); `execute_upgrade`
  panics before `executable_at`; an accepted transfer leaves no pending state.
- **Emits:** `admin_transfer_proposed`, `admin_transfer_completed`,
  `admin_transfer_cancelled`, `upgrade_proposed`, `upgrade_executed`,
  `upgrade_cancelled`.

## PriceOracle

Multi-oracle price feeds with weights, used to convert assets.

- **Entry points (write):** `init(owner, initial_oracle)` ·
  `update_price(...)` · `add_oracle(caller, oracle, pair, weight)` ·
  `remove_oracle(caller, oracle)`
- **Entry points (read):** `get_price(pair)` · `get_price_feed(pair)` ·
  `convert(...)` · `calculate_fee_in_asset(...)` · `is_authorized_oracle(addr)` ·
  `get_authorized_oracles()`
- **Access control:** only authorised oracles may `update_price`; oracle
  membership is owner-gated.
- **Invariants:** only oracles with weight > 0 contribute to an aggregate price;
  a removed oracle can no longer write.
- **Emits:** `price_updated`, `oracle_added`, `oracle_removed`.

## Governance

On-chain proposal → vote → timelock → execute workflow for merchant and platform
decisions.

- **Entry points (write):** `init(...)` · `create_proposal(...)` ·
  `cast_vote(...)` · `close_proposal(caller, id)` · `execute_proposal(caller, id)` ·
  `cancel_proposal(caller, id)` · `set_quorum_bps(caller, bps)`
- **Entry points (read):** `get_proposal(id)` · `has_voted(id, voter)` ·
  `get_vote(id, voter)` · `get_all_proposals()` ·
  `get_proposals_by_status(status)` · `get_owner()` · `get_voting_period()` ·
  `get_timelock()` · `get_quorum_bps()`
- **Access control:** the owner cancels and sets quorum; execution requires the
  proposal to have passed and the timelock to have elapsed.
- **Invariants:** a voter can vote once per proposal; a proposal only passes with
  quorum **and** a majority; execution is only possible after the timelock.
- **Emits:** `proposal_created`, `vote_cast`, `proposal_passed`,
  `proposal_rejected`, `proposal_executed`, `proposal_cancelled`.

## ImpactNFT

Soulbound-style reputation badges (merchant/customer tiers).

- **Entry points (write):** `init(owner)` · `register_badge_definition(...)` ·
  `update_badge_definition(...)` · `issue_badge(...)` · `revoke_badge(caller, id)`
- **Entry points (read):** `get_badge_definition(id)` · `get_badges(owner)` ·
  `get_badge_balance(owner, badge_id)` · `get_issued_badge(id)` ·
  `has_badge(owner, badge_type)` · `get_held_badge_types(owner)` · `get_owner()`
- **Access control:** definitions and issuance are owner-gated; `revoke_badge`
  requires the issuer.
- **Invariants:** a badge ID is issued at most once; balances are derived from
  issued badges and cannot exceed the number issued.
- **Emits:** `badge_issued`.

---

## Adding a contract

1. Add the crate under `contracts/<name>/` and to `members` in `Cargo.toml`.
2. Authorise every state-changing entry point; panic with a specific message.
3. Publish an event for every state change and add it to [EVENTS.md](./EVENTS.md)
   — the PR checklist enforces this.
4. Add unit tests, and fuzz tests if the contract is funds-at-risk.
5. Document it here and in [SECURITY.md](./SECURITY.md).
