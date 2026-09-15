# EPay Documentation

Index of everything under `docs/`. Start with **Getting Started** if you want to
run EPay, **Architecture** if you want to understand it, and **Contract
Integration** if you are integrating a partner system.

## Start here

| Doc                                                      | Read it when                                           |
| -------------------------------------------------------- | ------------------------------------------------------ |
| **[getting-started.md](./getting-started.md)**           | You want a first run in five minutes                   |
| **[architecture.md](./architecture.md)**                 | You want the system design and the reasoning behind it |
| **[contract-integration.md](./contract-integration.md)** | You are integrating EPay into an application           |
| **[webhook-receiver.md](./webhook-receiver.md)**         | You receive EPay webhooks                              |
| **[performance.md](./performance.md)**                   | You care about latency, SLOs, or load testing          |

## Indexer and testing

| Doc                        | Contents                                                                        |
| -------------------------- | ------------------------------------------------------------------------------- |
| [INDEXER.md](./INDEXER.md) | Event ingestion, the guarantees, its metrics, reconciliation, and the known gap |
| [TESTING.md](./TESTING.md) | Every test command, current counts, coverage floors, and the honest known gaps  |

## Status reports

| Doc                                                          | Contents                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [IMPLEMENTATION-AUDIT.md](./IMPLEMENTATION-AUDIT.md)         | Verified audit of the tree as it was on 2026-09-14           |
| [FINAL-ENGINEERING-REPORT.md](./FINAL-ENGINEERING-REPORT.md) | What was fixed, the readiness matrix, and what is still open |

## Operating EPay

| Doc                                                | Contents                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| [disaster-recovery.md](./disaster-recovery.md)     | RTO/RPO targets, failure modes, secret-compromise runbook                |
| [restore-runbook.md](./restore-runbook.md)         | Step-by-step manual restore, and the rollback path                       |
| [external-secrets.md](./external-secrets.md)       | Pulling credentials from a secret manager with External Secrets Operator |
| [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md)               | Deploy the live testnet demo from scratch                                |
| [../monitoring/README.md](../monitoring/README.md) | Prometheus, Grafana, Alertmanager, and what each alert means             |
| [../DEPLOYMENTS.md](../DEPLOYMENTS.md)             | Live testnet contract addresses                                          |

## Smart contracts

| Doc                                                                    | Contents                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [../packages/contracts/README.md](../packages/contracts/README.md)     | Every contract: entry points, access control, invariants              |
| [../packages/contracts/SECURITY.md](../packages/contracts/SECURITY.md) | Ownership model, two-step admin transfer, 72h upgrade timelock, pause |
| [../packages/contracts/EVENTS.md](../packages/contracts/EVENTS.md)     | Every emitted event, with topics and data                             |

## Decisions (ADRs)

Architecture Decision Records capture _why_, including the alternatives rejected.
They are append-only: to change a decision, add a new ADR that supersedes the old.

| ADR                                           | Decision                                         |
| --------------------------------------------- | ------------------------------------------------ |
| [0001](./adr/0001-chain-choice.md)            | Target Stellar/Soroban, not TON/Acton            |
| [0002](./adr/0002-custody-model.md)           | Non-custodial by construction                    |
| [0003](./adr/0003-auth-model.md)              | Authentication: JWT + API key + wallet signature |
| [0004](./adr/0004-upgrade-pattern.md)         | Two-step admin transfer and timelocked upgrades  |
| [0005](./adr/0005-contract-decomposition.md)  | Twelve discrete contracts instead of one         |
| [0006](./adr/0006-dashboard-decomposition.md) | Three dashboards instead of one role-gated app   |

## Contributing

| Doc                                              | Contents                                       |
| ------------------------------------------------ | ---------------------------------------------- |
| [../CONTRIBUTING.md](../CONTRIBUTING.md)         | Setup, commit convention, and the PR checklist |
| [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)   | Contributor Covenant v2.1                      |
| [../CONTRIBUTORS.md](../CONTRIBUTORS.md)         | Who builds EPay                                |
| [../ROADMAP.md](../ROADMAP.md)                   | Shipped / in progress / planned                |
| [../CHANGELOG.md](../CHANGELOG.md)               | What changed, per release (Keep a Changelog)   |
| [CONTRIBUTOR_ISSUES.md](./CONTRIBUTOR_ISSUES.md) | Scoped issues for external contributors        |

## Security

| Doc                                                                    | Contents                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| [../SECURITY.md](../SECURITY.md)                                       | Disclosure channels, response SLA, audit status |
| [../packages/contracts/SECURITY.md](../packages/contracts/SECURITY.md) | Contract-level threat model                     |

## Conventions in this directory

- **Lowercase, kebab-case filenames** (`disaster-recovery.md`), except the ADRs,
  which are numbered (`0001-chain-choice.md`).
- Every doc is linked from this index — an orphaned doc is a doc nobody reads.
- Operational docs state **targets and thresholds**, not aspirations. If a number
  can't be measured, it doesn't belong here.
