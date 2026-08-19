# EPay Wave Issue Backlog

A curated backlog of scoped, point-valued issues for Drips Wave contributors. Open these as
GitHub issues (use the `Wave Issue` template) and tag them with the point labels required by
the Wave Program.

## Point scale

Points are estimates of effort and impact. Use the program's own labeling convention when
opening issues, but the relative sizing below is a useful guide.

| Points | Meaning                    | Typical size                                |
| -----: | -------------------------- | ------------------------------------------- |
|     25 | Trivial / good first issue | Docs, small UI fix, single small file       |
|     50 | Small                      | Single-file feature or fix with tests       |
|    100 | Medium                     | Cross-cutting feature or multi-file change  |
|    200 | Large                      | Multi-component feature or integration test |

## Backlog

### 1. Fix dead footer and navigation links on the landing page — 25 pts

- **Type:** bug · **Difficulty:** beginner · **Label:** `good-first-issue`
- **Where:** `apps/web/src/components/landing/footer.tsx`, `apps/web/src/components/landing/navbar.tsx`
- **Problem:** Several footer links (Features, Pricing, Privacy Policy, Cookie Policy,
  Security, etc.) point to `#`, and the navbar "Pricing" link points to a non-existent
  `#pricing` section.
- **Acceptance criteria:** Every footer link resolves to a real page or an existing
  `#section` anchor; a dedicated Terms page is already wired to `/terms`.

### 2. Publish live testnet contract addresses — 25 pts

- **Type:** docs · **Difficulty:** beginner · **Label:** `documentation`
- **Where:** `DEPLOYMENTS.md`
- **Problem:** `ROADMAP.md` lists "Publish live testnet deployment to DEPLOYMENTS.md" as
  in-progress/planned, but the file does not yet contain deployed contract IDs.
- **Acceptance criteria:** Each deployed contract's testnet address and WASM hash are
  documented, with the deploy transaction hash.

### 3. Improve Swagger/OpenAPI coverage for auth and payment endpoints — 50 pts

- **Type:** docs/feature · **Difficulty:** beginner–intermediate · **Label:** `documentation`
- **Where:** `apps/api/src/auth/*`, `apps/api/src/payment/*`
- **Problem:** Several endpoints lack rich descriptions, examples, and response schemas.
- **Acceptance criteria:** Every public endpoint in the auth and payment modules has a
  description, request example, and response schema visible in `/api/docs`.

### 4. Add a drop-in Payment Link embed widget — 200 pts

- **Type:** feature · **Difficulty:** advanced · **Label:** `enhancement`
- **Where:** `apps/web`, `packages/sdk`, `apps/api`
- **Problem:** Merchants cannot embed a payment link on their own site; they must send
  customers to a hosted link (roadmap item 🎯).
- **Acceptance criteria:** A `<script>`/`<iframe>` embed renders a payment form, validates
  inputs client-side, and creates a payment through the SDK/API with test coverage.

### 5. Webhook delivery reliability: retries and dead-letter queue — 150 pts

- **Type:** feature · **Difficulty:** intermediate–advanced · **Label:** `enhancement`
- **Where:** `apps/api/src/webhook/*`, `apps/indexer`
- **Problem:** Webhook delivery has no durable retry/dead-letter behavior, so transient
  failures can drop events.
- **Acceptance criteria:** Failed deliveries are retried with backoff, permanently failed
  deliveries land in a dead-letter state visible in the admin dashboard, and behavior is
  covered by tests.

### 6. Escrow dispute-resolution timeout handling — 100 pts

- **Type:** bug/feature · **Difficulty:** intermediate · **Label:** `bug`
- **Where:** `packages/contracts/escrow-manager`, `apps/api/src/escrow/*`
- **Problem:** The dispute-resolution path does not clearly handle the case where a dispute
  is never resolved within the milestone window.
- **Acceptance criteria:** Unresolved disputes can be escalated or auto-resolved per the
  configured policy, with contract tests and API tests covering the timeout path.

### 7. Idempotency-key duplicate payment prevention tests — 100 pts

- **Type:** test/bug · **Difficulty:** intermediate · **Label:** `tests`
- **Where:** `apps/api/src/payment/*`, `apps/api/src/database/*`
- **Problem:** An `IdempotencyKey` model exists, but there is no test proving duplicate
  submissions do not create double payments.
- **Acceptance criteria:** Tests prove that replaying a request with the same idempotency
  key returns the original result and does not double-charge.

### 8. End-to-end integration test (contracts → indexer → API → dashboard) — 200 pts

- **Type:** test · **Difficulty:** advanced · **Label:** `tests`
- **Where:** repository-wide (`apps/*`, `packages/contracts`)
- **Problem:** Components are tested in isolation, but there is no full-path integration
  test (roadmap item 🎯).
- **Acceptance criteria:** An automated test drives a payment from contract invocation
  through indexing, API visibility, and a dashboard data assertion against a testnet or
  local Soroban environment.

### 9. Stellar asset support in settlement (USDC, yXLM) — 150 pts

- **Type:** feature · **Difficulty:** intermediate–advanced · **Label:** `enhancement`
- **Where:** `packages/contracts/settlement-manager`, `apps/api/src/settlement/*`
- **Problem:** Settlement is scoped to a single asset; merchants cannot settle in common
  Stellar assets (roadmap item 🎯).
- **Acceptance criteria:** The settlement contract and API accept a configurable asset,
  and trustline/issuer handling is covered by tests.

### 10. Analytics snapshot retention and rollup — 100 pts

- **Type:** feature · **Difficulty:** intermediate · **Label:** `enhancement`
- **Where:** `apps/api/src/analytics/*`, `apps/admin-dashboard`
- **Problem:** `AnalyticsSnapshot` grows unbounded; there is no rollup of older snapshots.
- **Acceptance criteria:** Older snapshots are rolled up to coarser granularity on a
  schedule, and the admin dashboard can display the rolled-up data.

### 11. Rate limiting and abuse detection on public endpoints — 100 pts

- **Type:** feature · **Difficulty:** intermediate · **Label:** `enhancement`
- **Where:** `apps/api` (auth and payment modules)
- **Problem:** Only some endpoints are rate-limited; abuse signals are not centralized.
- **Acceptance criteria:** Public endpoints have consistent rate limits, and repeated
  abuse produces an audit-logged event without degrading legitimate traffic.

### 12. Add architecture doc and point contributors to it — 25 pts

- **Type:** docs · **Difficulty:** beginner · **Label:** `documentation`, `good-first-issue`
- **Where:** `README.md`, `docs/ARCHITECTURE.md`, `docs/WAVE_ISSUES.md`
- **Problem:** `docs/ARCHITECTURE.md` exists but needs review and cross-linking from the
  README.
- **Acceptance criteria:** `docs/ARCHITECTURE.md` is linked from the README documentation
  section and reflects the current component list.

## How to open an issue

1. In GitHub, create a new issue using the **Wave Issue** template.
2. Copy the title, description, and acceptance criteria from the relevant backlog entry.
3. Apply the Wave Program's point label and any difficulty/type labels.
4. Reference this file (`docs/WAVE_ISSUES.md`) in the issue body so reviewers can see the
   backlog.
