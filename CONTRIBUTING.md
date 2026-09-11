# Contributing to EPay

Thank you for contributing! This guide covers how to set up the project, make changes, and submit pull requests.

## Code of Conduct

Be respectful. Be constructive. Follow the [Contributor Covenant](https://www.contributor-covenant.org/).

## Getting Started

```bash
git clone https://github.com/DamiDeji/EPay.git
cd EPay
pnpm install
cp .env.example .env
# Edit .env with your database credentials
pnpm --filter @epay/database prisma:generate
pnpm --filter @epay/database prisma:migrate
```

## Development Workflow

```bash
# Start the API
pnpm --filter @epay/api dev

# Start a dashboard
pnpm --filter @epay/web dev
pnpm --filter @epay/merchant-dashboard dev
pnpm --filter @epay/admin-dashboard dev

# Run typecheck on all packages
pnpm typecheck

# Run tests
pnpm test
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): description
fix(scope): description
docs(scope): description
test(scope): description
refactor(scope): description
chore(scope): description
```

Valid scopes: `contracts`, `api`, `web`, `merchant`, `admin`, `indexer`, `sdk`, `database`, `types`, `ui`, `hooks`, `shared`, `config`, `docs`, `ci`

## Pull Request Checklist

Copy this into your PR description and tick every box. Reviewers will not approve
an unticked box without a written reason.

**Correctness**
- [ ] TypeScript compiles with zero errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)
- [ ] Lint passes (`pnpm lint`)
- [ ] New behaviour has tests; bug fixes have a test that fails before the fix
- [ ] No `console.log` or `TODO` comments left in production code

**Contracts** (only if `packages/contracts/` changed)
- [ ] `cargo test --manifest-path packages/contracts/Cargo.toml` passes
- [ ] `cargo clippy -- -D warnings` is clean
- [ ] Every new public contract function has a unit test
- [ ] New functions and events are documented in the contract's `README`/
      `EVENTS` notes and listed in `CHANGELOG.md`

**API** (only if `apps/api/` changed)
- [ ] The OpenAPI spec is still accurate — `@ApiOperation`/`@ApiResponse`
      decorators updated for new or changed endpoints (`/api/docs` reflects it)
- [ ] New endpoints have a guard unless they are deliberately public
- [ ] Input validation (DTO or Zod) is present on every new input

**Operations** (only if `helm/`, `k8s/`, `monitoring/`, or `infra/` changed)
- [ ] `helm lint helm/epay` passes
- [ ] `helm template epay helm/epay` renders
- [ ] If the chart changed, `./scripts/render-k8s-manifests.sh` was run and
      `k8s/manifests.yaml` is committed (CI fails on drift)

**Compliance**
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]` in
      [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format
- [ ] The diff is **Gitleaks-clean** (`gitleaks detect --config .gitleaks.toml`)
      — no secrets, keys, or `.env` files
- [ ] Commit messages follow Conventional Commits
- [ ] I understand this contribution is licensed under the project's MIT licence

## Code Style

- Strict TypeScript — no `any` unless absolutely necessary
- Use `type` imports for type-only imports
- Prefer `interface` over `type` for object shapes
- Use `const` assertions for literal types
- Named exports over default exports (except Next.js pages)
- Sort imports: builtin → external → internal → parent → sibling

## Testing

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @epay/api test
pnpm --filter @epay/sdk test

# With coverage
pnpm --filter @epay/api test:coverage
pnpm --filter @epay/sdk test:coverage
```

## Questions?

Open a [GitHub Discussion](https://github.com/DamiDeji/EPay/discussions) or join our community.
