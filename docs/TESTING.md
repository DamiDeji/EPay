# Testing

Everything in this document is a command that runs today. The test counts are
the ones actually observed on the current tree; if a count here disagrees with
what you see, the document is stale and should be fixed with the code.

## Quick reference

| What                                                  | Command                                    |
| ----------------------------------------------------- | ------------------------------------------ |
| Everything CI runs (local parity)                     | `pnpm ci:local`                            |
| Fast subset (install, format, lint, typecheck, tests) | `pnpm ci:local:quick`                      |
| Only specific stages                                  | `pnpm ci:local --only lint,test,contracts` |
| List stage names                                      | `pnpm ci:local --list`                     |
| TypeScript lint                                       | `pnpm lint`                                |
| TypeScript typecheck                                  | `pnpm typecheck`                           |
| Formatting check                                      | `pnpm format:check`                        |
| Formatting fix                                        | `pnpm format`                              |
| All fast unit tests                                   | `pnpm test`                                |
| With coverage                                         | `pnpm test:coverage`                       |
| API tests only                                        | `pnpm --filter @epay/api test`             |
| SDK tests only                                        | `pnpm --filter @epay/sdk test`             |
| Contract tests only                                   | `pnpm contracts:test`                      |
| Contract static analysis                              | see [Contracts](#contracts)                |

## Local CI parity

`scripts/ci-local.sh` (exposed as `pnpm ci:local`, and `pnpm ci:local:quick` for the
fast subset) runs the same validation stages as
`.github/workflows/ci.yml`, plus one CI does not run: a Docker image build. A
green local run is therefore strictly stronger than a green CI run, never
weaker.

1. `install` — `pnpm install --frozen-lockfile`
2. `format-check` — Prettier (`format` job in CI)
3. `lint` — ESLint (flat config) across every workspace
4. `typecheck` — `tsc` across every workspace, **including tests, seeds and examples**
5. `contracts` — `cargo fmt --check`, `cargo clippy -D warnings`,
   `cargo test --workspace`, wasm release build
6. `test` — `test:coverage` across every workspace, thresholds enforced
7. `e2e` — Playwright, skipped with a warning when browsers are not installed
8. `security` — Gitleaks, plus an advisory `pnpm audit`
9. `helm` — `helm lint`, `helm template`, digest-pinning check, manifest drift check
10. `docker` — build the API image _(local only)_

Stages whose tool is missing are **reported and the run exits non-zero**, so a
green local run means the same thing as a green CI run. Pass `--allow-missing`
when you deliberately intend to run a subset (for example, on a machine without
Rust or Docker).

The scripts are deliberately _not_ named `ci`: `pnpm ci` is pnpm's own built-in
(`clean-install`, unimplemented as of pnpm 10) and shadows a `ci` script, so the
documented command could never have run it. Pass flags directly — `pnpm ci:local
--quick` — because pnpm forwards a literal `--` as an argument.

## Test inventory

| Workspace                                                     | Runner       | Tests            | Notes                                                              |
| ------------------------------------------------------------- | ------------ | ---------------- | ------------------------------------------------------------------ |
| `apps/api`                                                    | Jest         | 126 (18 suites)  | bootstraps Nest testing modules; Prisma is mocked                  |
| `apps/indexer`                                                | Vitest       | 114 (10 files)   | XDR decoding, checkpointing, retry/backoff, probes, reconciliation |
| `packages/sdk`                                                | Vitest       | 111 (4 files)    | resource-level unit tests                                          |
| `packages/shared`                                             | Vitest       | 78 (4 files)     | webhook signature, sessions, wallet validation, metrics registry   |
| `apps/extension`                                              | Vitest       | 12               | wallet/network detection                                           |
| `apps/mobile`                                                 | Vitest       | 11               | storage, notifications                                             |
| `apps/web`, `apps/merchant-dashboard`, `apps/admin-dashboard` | Vitest       | 17 (3 files)     | session keys and route-guard resolution                            |
| `packages/contracts`                                          | `cargo test` | 272 (16 crates)  | Soroban test host                                                  |
| `tests/e2e`                                                   | Playwright   | 9 (× 4 browsers) | runs in CI as the `e2e` job                                        |

### Known gaps

These are real and are not hidden behind a green build:

- **`tests/k6` load profiles are not wired into CI.** They need a provisioned
  API, database and Stellar sandbox; see `tests/k6/README.md`.
- **No third-party smart-contract audit.** Blocking for mainnet; see
  `packages/contracts/SECURITY.md`.
- **API coverage is below target** (~52% lines against the 80% goal, 90% for
  payment, refund, settlement and auth). The enforced floor only stops a
  regression.
- The three Next.js apps have unit tests for session and route-guard behaviour;
  page rendering is covered by `tests/e2e`, not by component tests.

Do not add `--passWithNoTests` to a package that should have tests; it turns
"never written" into "passing". No package uses it today.

## Coverage

Coverage is collected and gated for `apps/api`, `apps/indexer`, `packages/sdk`
and `packages/shared`. Every floor sits just below the level its suite currently
achieves: it exists to stop a regression, not to celebrate a number.

| Package           | Lines | Statements | Branches | Functions |
| ----------------- | ----- | ---------- | -------- | --------- |
| `apps/api`        | 50    | 50         | 60       | 70        |
| `apps/indexer`    | 90    | 90         | 80       | 85        |
| `packages/sdk`    | 85    | 85         | 65       | 90        |
| `packages/shared` | 90    | 90         | 80       | 95        |

Measured on the current tree: `apps/indexer` 96% lines / 87% branches,
`apps/api` 52% lines / 65% branches.

**Targets (not yet met):** 80% overall for the API, 90% for payment, refund,
settlement and auth code. Raise the thresholds as coverage improves; never lower
them to make a build pass.

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
docker build -f infra/docker/Dockerfile.api -t epay-api:local .
# also: infra/docker/Dockerfile.indexer, infra/docker/Dockerfile.web

helm lint helm/epay
helm template epay helm/epay --namespace epay >/dev/null

# The committed raw manifests must match the chart
./scripts/render-k8s-manifests.sh && git diff --exit-code k8s/manifests.yaml
```

## End-to-end tests

Playwright specs live in `tests/e2e` with their own `package.json` and
`playwright.config.ts`:

```bash
# From the repository root: Playwright starts and stops the web app itself.
pnpm --filter @epay/tests e2e

# Interactive, from tests/
cd tests && npx playwright test --ui
```

They **are** wired into CI, as the `e2e` job in `.github/workflows/ci.yml`. The
config's `webServer` block makes Playwright start and stop `@epay/web` itself,
and CI sets `reuseExistingServer: false` so a stale server can never be
mistaken for a passing run. The suite is 9 tests × 4 browser projects
(chromium, firefox, webkit, mobile-chrome); all 36 pass on the current tree. It
needs no API or database because the specs cover the landing page, the auth
pages and the client-side dashboard route guard.

## Load tests

`tests/k6/load-tests.js` targets payment creation, dashboard reads and
settlement. See `tests/k6/README.md`. Not run in CI.
