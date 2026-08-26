# EPay Contributor Issue Backlog

A curated backlog of well-scoped issues for external contributors (GrantFox, bounty
programs, hackathons, or general onboarding). Each issue includes an **area** label,
a **complexity** rating, and **acceptance criteria** so a contributor can self-select
and a maintainer can review quickly.

Issues marked ✅ **RESOLVED** were fixed in-repo (see the git history for the PR) and
are kept here as reference.

## Labels

| Area label | Applies to |
|-----------|-----------|
| `good-first-issue` | Small, well-documented, low-risk |
| `contracts` | Soroban (Rust) smart contracts in `packages/contracts` |
| `backend` | NestJS API, indexer, database |
| `frontend` | `apps/web`, `apps/merchant-dashboard`, `apps/admin-dashboard` |
| `docs` | README, docs/, SDK docs, deployment docs |
| `tests` | Test coverage anywhere |

**Complexity:** 🟢 beginner · 🟡 intermediate · 🔴 advanced

---

## 1. ✅ RESOLVED — Fix missing access control on FeeManager fee setters

- **Area:** `contracts` · **Complexity:** 🟡 intermediate
- **Status:** Fixed in `packages/contracts/contracts/fee-manager/src/lib.rs`
  (`require_owner(env, caller)` now compares the caller, setters call
  `caller.require_auth()`, and regression tests cover non-owner rejection).
- **Original problem:** `set_default_fee`/`set_merchant_fee` never verified the caller,
  so anyone could change platform fees.

## 2. Add Rust test suites for the seven contracts with empty stubs

- **Area:** `contracts` + `tests` · **Complexity:** 🟢 beginner
- **Where:** `packages/contracts/contracts/{subscription-manager,settlement-manager,invoice-manager,merchant-registry,role-manager,configuration-manager,emergency-pause}/src/test.rs`
- **Problem:** These contracts ship with `// TODO: Add contract tests` stubs, so their
  behavior is unverified. `payment-router`, `escrow-manager`, `treasury-vault`,
  `refund-manager`, and `fee-manager` now have real suites to use as templates.
- **Acceptance criteria:**
  - [ ] Each contract has tests for: init (and double-init panic), happy-path state
        transitions, every `should_panic` guard in `lib.rs`, and access control
        (non-owner rejected) where owner checks exist.
  - [ ] Token-moving contracts assert balances before/after transfers.
  - [ ] `cargo test --manifest-path packages/contracts/Cargo.toml` passes with no
        warnings from the new tests.

## 3. ✅ RESOLVED — Validate refund amounts in RefundManager

- **Area:** `contracts` · **Complexity:** 🟢 beginner
- **Status:** Fixed in `packages/contracts/contracts/refund-manager/src/lib.rs` —
  `request_refund` now panics on `amount <= 0` or `amount > original_amount`, with
  regression tests.
- **Original problem:** Any `amount` was accepted, including values larger than the
  original payment.

## 4. Add a caller allowlist for TreasuryVault.record_tx

- **Area:** `contracts` · **Complexity:** 🟡 intermediate
- **Where:** `packages/contracts/contracts/treasury-vault/src/lib.rs`
- **Problem:** `record_tx` is now owner-only (the unauthenticated bypass was fixed).
  The contract doc comments describe it as the accounting entry point for *other*
  EPay contracts (PaymentRouter, EscrowManager) that move tokens themselves — so when
  those contracts start recording on-chain, the owner-only check will block them.
- **Acceptance criteria:**
  - [ ] Owner can add/remove contract addresses to a persistent allowlist
        (`set_caller(caller, enabled)`), owner-only with tests.
  - [ ] `record_tx` accepts the owner **or** any allowlisted contract address.
  - [ ] Allowlist state survives across calls; tests cover add, remove, and
        non-owner attempts to modify it.

## 5. ✅ RESOLVED — Enforce min/max fee bounds in FeeManager setters

- **Area:** `contracts` · **Complexity:** 🟢 beginner
- **Status:** Fixed in `packages/contracts/contracts/fee-manager/src/lib.rs` —
  `init`, `set_default_fee`, and `set_merchant_fee` now reject values outside
  `[min_fee_bps, max_fee_bps]` with `"Fee outside allowed bounds"`; tests cover
  below-min, above-max, and boundary values.

## 6. ✅ RESOLVED — Use checked arithmetic in FeeManager.calculate_fee

- **Area:** `contracts` · **Complexity:** 🟢 beginner
- **Status:** Fixed in `packages/contracts/contracts/fee-manager/src/lib.rs` —
  `calculate_fee` uses `checked_mul`/`checked_div` and panics on overflow instead of
  silently wrapping in release builds; the overflow regression test passes.

## 7. Reject zero/negative amounts across payment, escrow, and subscription creation

- **Area:** `contracts` · **Complexity:** 🟡 intermediate
- **Where:** `packages/contracts/contracts/{payment-router,escrow-manager,subscription-manager}/src/lib.rs`
- **Problem:** `create_payment`, `create_escrow`, and subscription creation accept
  `amount <= 0` with no validation. A zero/negative amount creates unusable records
  (and negative transfers would revert, leaving inconsistent state assumptions).
  (RefundManager was already hardened — see issue 3.)
- **Acceptance criteria:**
  - [ ] Each creation function panics on `amount <= 0` with a descriptive message.
  - [ ] Tests cover zero, negative, and a minimum-positive amount.
  - [ ] `cargo test` passes with the new cases.

## 8. Deploy the API + indexer for a live testnet demo

- **Area:** `backend` + `docs` · **Complexity:** 🟡 intermediate
- **Where:** `apps/api`, `apps/indexer`, `.env.example`, `docs/DEMO_RUNBOOK.md`
- **Problem:** The smart contracts are deployed to testnet (see `DEPLOYMENTS.md`) and
  the web apps are on Vercel, but the API is not publicly hosted — so the dashboards
  cannot perform live actions. Reviewers currently can only read code.
- **Acceptance criteria:**
  - [ ] API runs from a public URL (container host: Railway/Render/Fly) connected to
        managed Postgres (Neon) and Redis (Upstash), with `DATABASE_URL`,
        `REDIS_URL`, `JWT_SECRET`, Stellar endpoints, and the 12 contract IDs from
        `.env.example` configured.
  - [ ] `GET /health` returns 200 publicly; CORS allows the three Vercel origins.
  - [ ] The indexer runs against testnet Horizon and records events to the same DB.
  - [ ] `docs/DEMO_RUNBOOK.md` documents every step so it is reproducible.

## 9. Add an Open Graph social preview image for the web app

- **Area:** `frontend` + `docs` · **Complexity:** 🟢 beginner
- **Where:** `apps/web/public/`, `apps/web/src/app/layout.tsx`
- **Problem:** `layout.tsx` defines `openGraph` metadata with no `images`, so sharing
  the demo link unfurls without a preview. The repo also has no social preview asset
  for GitHub (which currently shows a generic placeholder).
- **Acceptance criteria:**
  - [ ] A Stellar-branded 1200×630 image (PNG or SVG referenced by Next.js metadata)
        is added and wired via `openGraph.images`.
  - [ ] Sharing the deployed demo URL in a Slack/Discord/X message renders the image.
  - [ ] The same image is uploaded as the GitHub repo social preview
        (Settings → General → Social preview) so repo links render it too.

## 10. End-to-end integration test: contract → indexer → API → dashboard

- **Area:** `tests` · **Complexity:** 🔴 advanced
- **Where:** repository-wide (`packages/contracts`, `apps/indexer`, `apps/api`)
- **Problem:** Components are tested in isolation; no automated test proves a payment
  initiated on-chain becomes visible in the API and a dashboard.
- **Acceptance criteria:**
  - [ ] A script (testnet or local Soroban dev environment) invokes a contract payment,
        waits for the indexer to ingest it, and asserts the API exposes the payment.
  - [ ] It runs in CI (or is documented as a manual smoke test with exact commands).
  - [ ] Failure at any stage produces a clear diagnostic message.

## 11. Wire PaymentRouter fee calculation through the FeeManager contract

- **Area:** `contracts` · **Complexity:** 🟡 intermediate
- **Where:** `packages/contracts/contracts/payment-router/src/lib.rs`
- **Problem:** `PaymentRouter.init` stores a `fee_manager` address, but
  `create_payment` computes fees with a hardcoded `DEFAULT_FEE_BPS = 50` and never
  calls the configured FeeManager. The deployed, configurable fee engine is dead code,
  and merchant-specific fees can't apply to routed payments.
- **Acceptance criteria:**
  - [ ] `create_payment` calls the stored FeeManager (`calculate_fee`) for the
        merchant's fee instead of the hardcoded constant.
  - [ ] Falls back safely if the fee manager is not set, and the stored address is
        validated on init.
  - [ ] Tests prove a merchant fee override in FeeManager changes PaymentRouter fees,
        and that the default still matches 50 bps.
  - [ ] `cargo test` passes with the new cases.

## 12. Reentrancy hardening review for fund-handling contracts

- **Area:** `contracts` · **Complexity:** 🔴 advanced
- **Where:** `packages/contracts/contracts/{escrow-manager,refund-manager,treasury-vault}/src/`
- **Problem:** All fund-moving contracts follow checks-effects-interactions (state
  updated before the external token transfer), which is the right first line of
  defense — but there is no test proving a malicious/reentrant token contract cannot
  double-spend or replay a payout, and `EscrowManager`'s `EscrowStatus::Resolved` state
  leaves funds locked with no release path.
- **Acceptance criteria:**
  - [ ] A test harness with a reentrant token contract attempts to re-enter
        `complete_escrow`/`complete_refund`/`withdraw` during the transfer and proves
        state is committed first (no double payout).
  - [ ] A decision + test for the `Resolved` escrow state: either a documented
        `release_after_resolution` owner path or a test proving funds are only ever
        released once.
  - [ ] Findings (if any) are documented in `SECURITY.md`.

---

## Notes for maintainers

- Open issues with the **Issue** templates in `.github/ISSUE_TEMPLATE/`; add labels
  from the table above.
- The Wave backlog (`docs/WAVE_ISSUES.md`) is the point-valued variant used for Drips
  Wave; this file is the general-purpose onboarding backlog. Keep them in sync when
  scoping new work.
- Issues 2, 4, 7, 11, 12 are **contracts** work and should be reviewed by someone
  familiar with Soroban before merging — they touch fund-handling or access-control
  logic.
