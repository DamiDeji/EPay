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

- [ ] TypeScript compiles with zero errors (`pnpm typecheck`)
- [ ] All existing tests pass (`pnpm test`)
- [ ] New features include tests
- [ ] Documentation is updated (README, SDK docs, API docs)
- [ ] Commit messages follow Conventional Commits
- [ ] No `console.log` or `TODO` comments in production code

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
