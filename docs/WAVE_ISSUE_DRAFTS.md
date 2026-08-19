# Wave Issue Drafts (copy-paste ready)

Three of the top backlog items from [`docs/WAVE_ISSUES.md`](./WAVE_ISSUES.md), formatted as
complete GitHub issues. Copy each block into a new GitHub issue using the **Wave Issue**
template.

> **Point values:** Drips Wave tags issues with point values in the Wave app (when you add an
> issue to a Wave), not necessarily as a GitHub label. Apply the point value in the Wave app
> UI; use the GitHub labels below for normal triage.

---

## Issue 1 — Fix dead footer and navigation links on the landing page

**Title:** `Fix dead footer and navigation links on the landing page`

**Labels:** `bug`, `good-first-issue`, `help wanted`

**Points:** 25

**Body:**

```markdown
## Overview

The landing page footer lists several links that point to `#` (dead), and the navbar
"Pricing" link points to a `#pricing` section that does not exist.

## Details

- `apps/web/src/components/landing/footer.tsx` — `FOOTER_LINKS` defines Product, Resources,
  Company, and Legal columns. Only "Terms of Service" currently resolves to a real route
  (`/terms`); every other entry uses `href="#"`.
- `apps/web/src/components/landing/navbar.tsx` — `NAV_LINKS` includes `#features`,
  `#how-it-works`, and `#pricing`. The homepage (`apps/web/src/app/page.tsx`) has
  `#features` and `#how-it-works` sections but no `#pricing` section.

## Acceptance Criteria

- [ ] No footer link uses a bare `#` — each points to a real route, a real `#section`
      anchor, or an external URL.
- [ ] The navbar "Pricing" link points to a real `#pricing` section (add the section) or is
      removed/relabeled to something that exists.
- [ ] "Terms of Service" continues to resolve to `/terms`.
- [ ] Prefer Next.js `<Link>` for internal routes.

## Hints

- Check `apps/web/src/app/page.tsx` for existing section `id`s.
- Verify with `pnpm --filter @epay/web dev` and click every link.
```

---

## Issue 2 — Publish live testnet contract addresses to DEPLOYMENTS.md

**Title:** `Publish live testnet contract addresses to DEPLOYMENTS.md`

**Labels:** `documentation`, `good-first-issue`

**Points:** 25

**Body:**

```markdown
## Overview

`ROADMAP.md` lists "Publish live testnet deployment to DEPLOYMENTS.md" as in progress, but
`DEPLOYMENTS.md` does not yet contain deployed contract IDs.

## Details

Deploy (or reuse existing deployments of) the 12 Soroban contracts and record each one:

- Contract name
- Network (testnet)
- Contract ID
- WASM hash
- Deploy transaction hash
- Admin address (if set)

## Acceptance Criteria

- [ ] `DEPLOYMENTS.md` lists all 12 contracts with contract IDs and WASM hashes.
- [ ] Includes the network (testnet) and deploy transaction hashes.
- [ ] At least one contract ID is verified to load in a Stellar explorer or via the
      `soroban`/`stellar` CLI.

## Hints

- See `.github/workflows/contracts.yml` for the build/optimize commands already in CI.
- Relevant CLI commands: `soroban contract deploy`, `soroban contract install`,
  `soroban contract optimize`.
```

---

## Issue 3 — Improve Swagger/OpenAPI coverage for auth and payment endpoints

**Title:** `Improve Swagger/OpenAPI coverage for auth and payment endpoints`

**Labels:** `documentation`, `enhancement`

**Points:** 50

**Body:**

```markdown
## Overview

Several endpoints in the auth and payment modules lack rich descriptions, request examples,
and response schemas in the Swagger UI at `/api/docs`.

## Details

- `apps/api/src/auth/*`
- `apps/api/src/payment/*`

Add `@ApiOperation`, `@ApiResponse`, `@ApiBody`, and `@ApiProperty` decorators where they are
missing, so the API is self-documenting.

## Acceptance Criteria

- [ ] Every public endpoint in the auth and payment modules shows a description, request
      example, and response schema in `/api/docs`.
- [ ] No type errors: `pnpm --filter @epay/api typecheck`.

## Hints

- Uses `@nestjs/swagger`.
- Run `pnpm --filter @epay/api dev` and open `http://localhost:4000/api/docs` to verify.
```
