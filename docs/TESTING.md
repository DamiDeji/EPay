# Testing

Everything in this document is a command that runs today. The test counts are
the ones actually observed on the current tree; if a count here disagrees with
what you see, the document is stale and should be fixed with the code.

## Quick reference

| What                                                  | Command                                 |
| ----------------------------------------------------- | --------------------------------------- |
| Everything CI runs (local parity)                     | `pnpm ci`                               |
| Fast subset (install, format, lint, typecheck, tests) | `pnpm ci:quick`                         |
| Only specific stages                                  | `pnpm ci -- --only lint,test,contracts` |
| List stage names                                      | `pnpm ci -- --list`                     |
| TypeScript lint                                       | `pnpm lint`                             |
| TypeScript typecheck                                  | `pnpm typecheck`                        |
| Formatting check                                      | `pnpm format:check`                     |
| Formatting fix                                        | `pnpm format`                           |
| All fast unit tests                                   | `pnpm test`                             |
| With coverage                                         | `pnpm test:coverage`                    |
| API tests only                                        | `pnpm --filter @epay/api test`          |
| SDK tests only                                        | `pnpm --filter @epay/sdk test`          |
| Contract tests only                                   | `pnpm contracts:test`                   |
| Contract static analysis                              | see [Contracts](#contracts)             |

## Local CI parity

`scripts/ci-local.sh` (exposed as `pnpm ci`) runs the same stages as
`.github/workflows/ci.yml`:

1. `install` — `pnpm install --frozen-lockfile`
2. `format-check` — Prettier
3. `lint` — ESLint (flat config) across every workspace
4. `typecheck` — `tsc` across every workspace, **including tests, seeds and examples**
5. `contracts` — `cargo fmt --check`, `cargo clippy -D warnings`,
   `cargo test --workspace`, wasm release build
6. `test` — Jest/Vitest across every workspace
7. `security` — Gitleaks, plus an advisory `pnpm audit`
8. `helm` — `helm lint`, `helm template`, digest-pinning check, manifest drift check
9. `docker` — build the API image

Stages whose tool is missing are **reported and the run exits non-zero**, so a
green local run means the same thing as a green CI run. Pass `--allow-missing`
when you deliberately intend to run a subset (for example, on a machine without
Rust or Docker).

## Test inventory

| Workspace                                                     | Runner       | Tests           | Notes                                             |
| ------------------------------------------------------------- | ------------ | --------------- | ------------------------------------------------- |
| `apps/api`                                                    | Jest         | 136 (19 suites) | bootstraps Nest testing modules; Prisma is mocked |
| `packages/sdk`                                                | Vitest       | 91 (4 files)    | resource-level unit tests                         |
| `packages/shared`                                             | Vitest       | 17              | webhook signature, wallet validation              |
| `apps/extension`                                              | Vitest       | 12              | wallet/network detection                          |
| `apps/mobile`                                                 | Vitest       | 11              | storage, notifications                            |
| `packages/contracts`                                          | `cargo test` | 272 (16 crates) | Soroban test host                                 |
| `apps/indexer`                                                | Vitest       | **0**           | gap — see below                                   |
| `apps/web`, `apps/merchant-dashboard`, `apps/admin-dashboard` | Vitest       | **0**           | gap — see below                                   |

### Known gaps

These are real and are not hidden behind a green build:

- **The indexer has no tests** even though it parses untrusted blockchain
  events, checkpoints progress, and writes to the database. Highest-value
  untested surface in the repository.
- **The three Next.js apps have no tests.** Route guards and role-based access
  are unproven.
- `tests/e2e/*.spec.ts` (Playwright) and `tests/k6/*` exist but are not run in
  CI yet.

Do not add `--passWithNoTests` to a package that should have tests; it turns
"never written" into "passing".

## Coverage

Coverage is collected for `apps/api` and `packages/sdk`. `apps/api/jest.config.js`
enforces a floor (`coverageThreshold`) set just below the current level
(lines/statements ≥ 50%, branches ≥ 60%, functions ≥ 70%). The floor exists to
stop regressions.

**Targets (not yet met):** 80% overall, 90% for payment, refund, settlement and
auth code. Raise the thresholds as coverage improves; never lower them to make a
build pass.

```bash
pnpm test:coverage                     # all workspaces
pnpm --filter @epay/api test:coverage  # API only, enforced threshold
```

## Contracts

The Soroban crate is a Cargo workspace at `packages/contracts`.

```bash
# Static analysis
cd packages/contracts
cargo fmt --check
cargo clippy --all-targets -- -D warnings

# Tests (all 16 contracts)
cargo test --workspace

# One contract
cargo test -p payment-router

# Deployable artefacts
cargo build --workspace --target wasm32-unknown-unknown --release
```

Prerequisites: a Rust toolchain and the wasm target:

```bash
rustup target add wasm32-unknown-unknown
```

### How the contract suites are structured

Every contract has `src/test.rs`. The funds-at-risk contracts additionally have
`src/fuzz.rs`, which drives a deterministic xorshift64* PRNG so a failure
reproduces exactly with no extra dependencies (no `proptest` in the SBOM).

Two rules matter when editing them:

1. **`env.budget().reset_unlimited()`** is required at the top of any test that
   performs hundreds of metered contract calls. Without it the host aborts with
   `Error(Budget, ExceededLimit)` before your assertion runs.
2. **Use the registered contract id**, e.g.
   `let contract_id = env.register_contract(None, MyContract);`
   `env.current_contract_address()` only works _inside_ a contract invocation
   and panics in test scope.

Iteration counts in `fuzz.rs` are deliberately sized so the whole suite finishes
in a few minutes; raise them locally when hunting a rare violation.

## Security checks

```bash
# Secret scanning (blocking in CI)
gitleaks detect --config .gitleaks.toml --verbose --no-git

# Dependency advisories (advisory today, should become blocking)
pnpm audit --audit-level=high
```

## Docker and Helm

```bash
docker build -f apps/api/Dockerfile -t epay-api:local .

helm lint helm/epay
helm template epay helm/epay --namespace epay >/dev/null

# The committed raw manifests must match the chart
./scripts/render-k8s-manifests.sh && git diff --exit-code k8s/manifests.yaml
```

## End-to-end tests

Playwright specs live in `tests/e2e` with their own `package.json` and
`playwright.config.ts`:

```bash
cd tests
pnpm install
npx playwright test          # requires a running API + web app
npx playwright test --ui     # interactive
```

These are not wired into CI yet — the stack they need (API, indexer, Postgres,
Redis, Stellar sandbox) is not provisioned by the workflow.

## Load tests

`tests/k6/load-tests.js` targets payment creation, dashboard reads and
settlement. See `tests/k6/README.md`. Not run in CI.
