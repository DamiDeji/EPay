# ADR 0006 — Three dashboards instead of one role-gated app

- **Status:** Accepted
- **Date:** 2026-09-14
- **Deciders:** EPay maintainers
- **Related:** [ADR 0003](./0003-auth-model.md) (auth model)

## Context

EPay serves three audiences with different goals:

| Audience | Wants | Almost never touches |
| --- | --- | --- |
| **Customers** | Pay, view payment history, manage a wallet, track escrow | Merchant analytics, platform config |
| **Merchants** | Invoices, analytics, settlements, refunds, payment links | Merchant onboarding queues, platform config |
| **Admins** | Approve merchants, audit log, emergency pause, platform health | Customer checkout flows |

One codebase could serve all three behind a role check:

```
/app
  /dashboard        (all users)
  /merchants        (merchant+)
  /admin            (admin only)   ← guarded by a client-side + server-side check
```

Or three applications could, sharing a component library.

## Decision

EPay ships **three separate Next.js applications** — `apps/web`,
`apps/merchant-dashboard`, `apps/admin-dashboard` — over shared packages
(`@epay/ui`, `@epay/hooks`, `@epay/types`, `@epay/shared`).

### Why

- **The admin surface is a different security domain.** `admin-dashboard` can
  approve merchants and pull the emergency pause. Shipping it in the same bundle
  as the customer checkout means admin code — and admin route definitions — are
  present in every customer's browser, and a routing bug is a privilege-escalation
  bug. Separate apps make the boundary a **deployment** boundary, not a conditional.
  They can be exposed differently (different hostnames, IP allow-lists, WAF rules)
  or not exposed publicly at all.
- **Smallest possible payload per audience.** A customer should not download
  Recharts, settlement tables, or an audit viewer to pay an invoice. Each app
  ships only what its audience needs, which matters on the mobile connections many
  customers use.
- **Independent deploys and rollbacks.** A dashboard layout change should not
  require redeploying the customer checkout — the highest-traffic, highest-stakes
  surface. Blast radius of a frontend bug stays within one audience.
- **Clear ownership.** Each app maps to one audience's mental model and one set of
  owners; there is no shared route table where roles must be reasoned about.
- **Shared components, not shared *pages*.** The duplication that matters
  (buttons, tables, hooks, types) lives in `@epay/*` packages, so three apps do not
  mean three implementations — only three entry points.

### Alternatives considered

**One app, server-side role routing.** Rejected: correct in principle, but it puts
the most privileged UI in the same artifact as the most public one, where a single
mis-scoped route silently exposes it. It also forces one deploy cadence on three
audiences with very different risk tolerance.

**One app, three builds (env-selected).** Rejected: closer, but it introduces a
"which mode was this artifact built in?" ambiguity — exactly the class of mistake
that is invisible in review and fatal at runtime. Three apps cannot be mis-built
into the wrong role.

**Separate *services* with a shared shell (micro-frontends).** Rejected as
over-engineering at this scale: the operational cost (multiple runtimes, shared
routing, version skew) buys nothing three static-ish Next apps do not already give.

## Consequences

- **Three deployments, three CI pipelines, three sets of env vars.** The Helm
  chart renders the frontends from a single list
  (`helm/epay/values.yaml` → `frontends:`) to keep them from drifting.
- **Version skew is possible.** The three apps release independently; a shared
  API change must remain backward-compatible long enough for all three to catch up.
  This is a reason to prefer additive API changes.
- **Consistency is a maintenance burden.** A visual change must land in three
  apps; the shared `@epay/ui` package is what keeps the drift small, and reviewing a
  change to it means reviewing all three consumers.
- **Three hostnames.** TLS, CORS (`CORS_ORIGINS`), and the correlation of
  dashboards to audiences are explicit operational concerns rather than implicit.
- **Reversing this** is cheap relative to the contract decisions: the three apps
  could be merged behind a router. That asymmetry is deliberate — this ADR is
  reversible, the chain and contract ones are not.
