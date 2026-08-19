# Drips Wave — Repository Appeal

This file contains a ready-to-submit appeal for the rejected EPay repository, plus
instructions on where to submit it.

## Where to submit

Per the [Drips Wave Terms, §3.1](https://docs.drips.network/wave/terms-and-rules/), an
appeal must be submitted **only** through the Drips Wave app:

> Maintainers → Orgs and Repos → (rejected repository) → **Appeal**

Appeals sent through any other channel are not considered.

## Appeal message (copy-paste ready)

```
Subject: Appeal for EPay repository admission

Hi Drips Wave team,

I'm the maintainer of EPay (github.com/DamiDeji/EPay), which was recently
rejected from the Stellar Wave Program. I'd like to respectfully appeal and
provide additional context on the relevance criteria.

EPay is a decentralized payment gateway built natively on Stellar and Soroban:

- 12 Soroban smart contracts (payment router, invoice, escrow, refund,
  subscription, settlement, treasury, fee, registry, configuration,
  emergency pause, and role manager)
- A NestJS REST API with 15 modules, JWT + Stellar wallet authentication,
  and Swagger documentation
- Three dashboards (customer, merchant, admin), a blockchain indexer, and a
  TypeScript SDK
- ~21,000 lines of source across 238 files, with 32 test suites covering the
  API, contracts, and SDK

The project was created to apply to the Stellar Community Fund (SCF) Wave 8,
which is why the early history contains a commit referencing "grant-readiness"
and a migration away from a prior TON prototype. That work was preparation for
SCF, not an attempt to game Drips Wave — but I understand how it could read
that way and I'm happy to clarify it.

I acknowledge that the repo is young and that I am a new maintainer in the
ecosystem, so I do not yet meet the "past repo & hackathon activity" bar. What
I can commit to:

- Sustained, substantive contributions to EPay across Waves (features, fixes,
  and tests — not just CI and docs)
- Actively contributing to other Stellar/Soroban projects to build genuine
  ecosystem presence
- Opening a well-scoped, point-valued issue backlog so Wave contributors can
  add real value

I would welcome any specific feedback on what would make EPay a good fit, and
I'm open to being reconsidered in a future Wave if this one isn't appropriate.

Thank you for your time and for building Drips Wave.

Best,
[Your name / GitHub handle]
```

## Notes before submitting

- Keep it truthful. Do not overstate activity that does not exist — reviewers can see the
  commit history and will discount an appeal that overclaims.
- If the rejection reason you received is more specific than the generic notice, tailor the
  message to answer that specific concern directly.
- Submit the appeal **after** some of the items in
  [`docs/WAVE_ISSUES.md`](./WAVE_ISSUES.md) and
  [`docs/ECOSYSTEM_CONTRIBUTIONS.md`](./ECOSYSTEM_CONTRIBUTIONS.md) are underway, so the
  appeal reflects real progress rather than promises.
