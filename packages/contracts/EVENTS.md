# Contract Event Catalogue

Every state change in EPay's Soroban contracts publishes an event. The indexer
(`apps/indexer`) subscribes to Soroban contract events and decodes them into
PostgreSQL records; anything not listed here is invisible to the off-chain
read-model.

**If you add or rename an event, update this file in the same pull request.** The
PR checklist in [CONTRIBUTING.md](../../CONTRIBUTING.md) requires it, because a
contract that emits an undocumented event is a silent gap in the indexer.

## Conventions

Events are published with `env.events().publish(topics, data)`. In Soroban:

- `topics` is a tuple; the **first** topic is the event name, a `Symbol`
  (`symbol_short!` or `Symbol::new`) — this is what subscribers filter on.
- `data` is the value payload, a tuple. All amounts are `i128` stroops unless
  noted otherwise.
- Topic symbols are limited to 32 characters, so names are abbreviated where
  necessary (`merchant_react`, `sub_created`, `settlement_done`).

Example decoding — `escrow_created`:

```text
topics: [ "escrow_created" ]
data:   ( escrow_id: u64, merchant: Address, customer: Address, total_amount: i128 )
```

---

## PaymentRouter

| Event               | Topics              | Data                           | Emitted when                              |
| ------------------- | ------------------- | ------------------------------ | ----------------------------------------- |
| `payment_created`   | `payment_created`   | `(payment_id: u64)`            | A new payment is recorded                 |
| `payment_confirmed` | `payment_confirmed` | `(payment_id: u64)`            | The payment is confirmed with a `tx_hash` |
| `payment_completed` | `payment_completed` | `(payment_id: u64)`            | Funds have settled to the merchant        |
| `fee_collected`     | `fee_collected`     | `(payment_id: u64, fee: i128)` | Platform fee taken alongside a completion |
| `payment_failed`    | `payment_failed`    | `(payment_id: u64)`            | The payment moved to `failed`             |
| `payment_refunded`  | `payment_refunded`  | `(payment_id: u64)`            | An admin refunded the payment             |

## InvoiceManager

| Event               | Topics              | Data                              | Emitted when                      |
| ------------------- | ------------------- | --------------------------------- | --------------------------------- |
| `invoice_created`   | `invoice_created`   | `(invoice_id: u64, amount: i128)` | A draft invoice is created        |
| `invoice_issued`    | `invoice_issued`    | `(invoice_id: u64)`               | Draft → issued                    |
| `invoice_paid`      | `invoice_paid`      | `(invoice_id: u64)`               | Invoice settled against a payment |
| `invoice_cancelled` | `invoice_cancelled` | `(invoice_id: u64)`               | Invoice cancelled before payment  |

`mark_overdue` deliberately emits nothing: it is a derived status the API can
recompute from `due_date`, and the indexer does not need an on-chain nudge.

## EscrowManager

| Event              | Topics             | Data                                                                         | Emitted when                          |
| ------------------ | ------------------ | ---------------------------------------------------------------------------- | ------------------------------------- |
| `escrow_created`   | `escrow_created`   | `(escrow_id: u64, merchant: Address, customer: Address, total_amount: i128)` | Escrow opened (unfunded)              |
| `escrow_funded`    | `escrow_funded`    | `(escrow_id: u64)`                                                           | Customer funds the escrow             |
| `escrow_completed` | `escrow_completed` | `(escrow_id: u64)`                                                           | Admin releases funds to the merchant  |
| `escrow_disputed`  | `escrow_disputed`  | `(escrow_id: u64)`                                                           | Merchant or customer raises a dispute |
| `escrow_resolved`  | `escrow_resolved`  | `(escrow_id: u64)`                                                           | Admin resolves the dispute            |
| `escrow_cancelled` | `escrow_cancelled` | `(escrow_id: u64)`                                                           | Unfunded escrow cancelled             |
| `escrow_refunded`  | `escrow_refunded`  | `(escrow_id: u64)`                                                           | Admin returns funds to the customer   |

## RefundManager

| Event              | Topics             | Data                                              | Emitted when                     |
| ------------------ | ------------------ | ------------------------------------------------- | -------------------------------- |
| `refund_requested` | `refund_requested` | `(refund_id: u64, payment_id: u64, amount: i128)` | Payer or merchant opens a refund |
| `refund_approved`  | `refund_approved`  | `(refund_id: u64)`                                | Admin approves                   |
| `refund_completed` | `refund_completed` | `(refund_id: u64)`                                | Funds returned                   |
| `refund_rejected`  | `refund_rejected`  | `(refund_id: u64)`                                | Admin rejects                    |

## SubscriptionManager

| Event           | Topics          | Data            | Emitted when                 |
| --------------- | --------------- | --------------- | ---------------------------- |
| `sub_created`   | `sub_created`   | `(sub_id: u64)` | Subscription created         |
| `sub_renewed`   | `sub_renewed`   | `(sub_id: u64)` | A billing period was charged |
| `sub_paused`    | `sub_paused`    | `(sub_id: u64)` | Subscription paused          |
| `sub_cancelled` | `sub_cancelled` | `(sub_id: u64)` | Subscription cancelled       |

## SettlementManager

| Event                | Topics               | Data                   | Emitted when                              |
| -------------------- | -------------------- | ---------------------- | ----------------------------------------- |
| `settlement_created` | `settlement_created` | `(settlement_id: u64)` | A settlement batch is created (`PENDING`) |
| `settlement_done`    | `settlement_done`    | `(settlement_id: u64)` | Batch processed (`COMPLETED`)             |

## MerchantRegistry

| Event                | Topics               | Data                 | Emitted when                   |
| -------------------- | -------------------- | -------------------- | ------------------------------ |
| `merchant_reg`       | `merchant_reg`       | `(merchant_id: u64)` | Merchant registered            |
| `merchant_verified`  | `merchant_verified`  | `(merchant_id: u64)` | Verifier approved the merchant |
| `merchant_suspended` | `merchant_suspended` | `(merchant_id: u64)` | Admin suspended the merchant   |
| `merchant_react`     | `merchant_react`     | `(merchant_id: u64)` | Admin reactivated the merchant |

## TreasuryVault

| Event                  | Topics                 | Data           | Emitted when                                     |
| ---------------------- | ---------------------- | -------------- | ------------------------------------------------ |
| `treasury_deposit`     | `treasury_deposit`     | `(tx_id: u64)` | Tokens deposited into the vault                  |
| `treasury_withdraw`    | `treasury_withdraw`    | `(tx_id: u64)` | Tokens withdrawn from the vault                  |
| `treasury_tx_recorded` | `treasury_tx_recorded` | `(tx_id: u64)` | A non-transferring accounting entry was recorded |

## FeeManager

No events. Fee configuration is read with `get_config()` / `calculate_fee()`;
changing it emits nothing because the _effect_ is visible in the
`fee_collected` event on the next payment.

## ConfigurationManager

| Event            | Topics           | Data | Emitted when                                    |
| ---------------- | ---------------- | ---- | ----------------------------------------------- |
| `config_updated` | `config_updated` | `()` | Platform config written (maintenance mode etc.) |

## EmergencyPause

| Event      | Topics     | Data | Emitted when             |
| ---------- | ---------- | ---- | ------------------------ |
| `paused`   | `paused`   | `()` | Circuit breaker engaged  |
| `unpaused` | `unpaused` | `()` | Circuit breaker released |

## RoleManager

| Event           | Topics          | Data                            | Emitted when      |
| --------------- | --------------- | ------------------------------- | ----------------- |
| `role_assigned` | `role_assigned` | `(target: Address, role: Role)` | A role is granted |
| `role_revoked`  | `role_revoked`  | `(target: Address, role: Role)` | A role is removed |

## UpgradeManager

| Event                      | Topics                     | Data                                                      | Emitted when                           |
| -------------------------- | -------------------------- | --------------------------------------------------------- | -------------------------------------- |
| `admin_transfer_proposed`  | `admin_transfer_proposed`  | `(caller: Address, new_admin: Address)`                   | Admin proposes a handover              |
| `admin_transfer_completed` | `admin_transfer_completed` | `(caller: Address)`                                       | Proposed admin accepts                 |
| `admin_transfer_cancelled` | `admin_transfer_cancelled` | `()`                                                      | Pending transfer withdrawn             |
| `upgrade_proposed`         | `upgrade_proposed`         | `(proposal_id: u64, caller: Address, executable_at: u64)` | A WASM upgrade enters its 72h timelock |
| `upgrade_executed`         | `upgrade_executed`         | `(proposal_id: u64, wasm_hash: Vec<u8>, at: u64)`         | Admin executes after the timelock      |
| `upgrade_cancelled`        | `upgrade_cancelled`        | `(proposal_id: u64)`                                      | Admin cancels a pending upgrade        |

## PriceOracle

| Event            | Topics           | Data                                                                   | Emitted when                           |
| ---------------- | ---------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| `price_updated`  | `price_updated`  | `(pair: String, price: i128, decimals: u32, source: Address, at: u64)` | An authorised oracle publishes a price |
| `oracle_added`   | `oracle_added`   | `(oracle: Address, asset_pair: String, weight: u32)`                   | Oracle registered for a pair           |
| `oracle_removed` | `oracle_removed` | `(oracle: Address)`                                                    | Oracle de-registered                   |

## Governance

| Event                | Topics               | Data                                                                   | Emitted when                  |
| -------------------- | -------------------- | ---------------------------------------------------------------------- | ----------------------------- |
| `proposal_created`   | `proposal_created`   | `(proposal_id: u64, proposer: Address, title: String)`                 | Proposal opened               |
| `vote_cast`          | `vote_cast`          | `(proposal_id: u64, voter: Address, choice: VoteChoice, weight: i128)` | A vote is recorded            |
| `proposal_passed`    | `proposal_passed`    | `(proposal_id: u64, result: VoteResult)`                               | Quorum + majority reached     |
| `proposal_rejected`  | `proposal_rejected`  | `(proposal_id: u64, result: VoteResult)`                               | Voting closed without passing |
| `proposal_executed`  | `proposal_executed`  | `(proposal_id: u64, proposal_type: ProposalType)`                      | Executed after the timelock   |
| `proposal_cancelled` | `proposal_cancelled` | `(proposal_id: u64)`                                                   | Owner cancelled               |

## ImpactNFT

| Event          | Topics         | Data                                                  | Emitted when                 |
| -------------- | -------------- | ----------------------------------------------------- | ---------------------------- |
| `badge_issued` | `badge_issued` | `(badge_id: u64, owner: Address, definition_id: u64)` | A reputation badge is minted |

`revoke_badge` and badge-definition updates currently emit nothing; only issuance
is indexed. Extending this is tracked in [ROADMAP.md](../../ROADMAP.md).

---

## Consuming events

The indexer derives its subscriptions from this table. To add a handler:

1. Add the event here.
2. Decode the topic + data tuple in `apps/indexer/src/handlers/`.
3. Persist to Prisma in the same handler so a replay is idempotent.
4. Add a unit test that feeds a fixture event through the handler.
