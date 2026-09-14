## Description

<!-- Describe your changes in detail -->

## Type of Change

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 📚 Documentation
- [ ] 🧪 Test
- [ ] 🔧 Refactor
- [ ] ⚡ Performance
- [ ] 🔒 Security

## Scope

- [ ] Smart Contracts
- [ ] API Server
- [ ] Customer Dashboard
- [ ] Merchant Dashboard
- [ ] Admin Dashboard
- [ ] SDK
- [ ] Indexer
- [ ] Explorer
- [ ] Database / Types
- [ ] CI/CD / Tooling

## Checklist

**Correctness**
- [ ] TypeScript compiles with zero errors (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] All tests pass (`pnpm test`); bug fixes include a test that fails before the fix
- [ ] No `console.log`, `debugger`, or `TODO` comments in production code
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)

**API** (if `apps/api/` changed)
- [ ] OpenAPI/Swagger decorators updated so `/api/docs` still matches the code
- [ ] New endpoints have a guard unless deliberately public, plus input validation

**Contracts** (if `packages/contracts/` changed)
- [ ] `cargo test --manifest-path packages/contracts/Cargo.toml` passes
- [ ] `cargo clippy -- -D warnings` is clean
- [ ] **New or renamed events are added to [`packages/contracts/EVENTS.md`](../blob/main/packages/contracts/EVENTS.md)**
- [ ] Contract docs updated in `packages/contracts/README.md` / `SECURITY.md`

**Operations** (if `helm/`, `k8s/`, `monitoring/`, or `infra/` changed)
- [ ] `helm lint helm/epay` and `helm template epay helm/epay` pass
- [ ] `./scripts/render-k8s-manifests.sh` re-run and `k8s/manifests.yaml` committed (CI fails on drift)

**Compliance**
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]` (Keep a Changelog format)
- [ ] The diff is **Gitleaks-clean** (`gitleaks detect --config .gitleaks.toml`) — no secrets or `.env` files

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Related Issues

<!-- Link to related issues: Closes #123, Fixes #456 -->
