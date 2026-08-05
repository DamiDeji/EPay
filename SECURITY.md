# Security Policy

## Reporting a Vulnerability

EPay takes security seriously. We appreciate responsible disclosure of security vulnerabilities.

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, send an email to **security@epay.dev** with:

- A detailed description of the vulnerability
- Steps to reproduce the issue
- Affected versions / components
- Any potential mitigations you've identified

We will respond within **48 hours** and work with you on a coordinated disclosure timeline.

## Scope

| Component | Scope |
|-----------|-------|
| Smart contracts (`packages/contracts/`) | ✅ In scope |
| REST API (`apps/api/`) | ✅ In scope |
| SDK (`packages/sdk/`) | ✅ In scope |
| Blockchain indexer (`apps/indexer/`) | ✅ In scope |
| Web dashboards | ✅ In scope |
| CI/CD pipelines | ✅ In scope |

## Security Model

EPay is a decentralized payment gateway. The security model addresses:

| Threat | Mitigation |
|--------|-----------|
| Reentrancy | Checks-effects-interactions pattern in all contracts |
| Front-running | Nonce-based replay protection |
| Signature forgery | TON wallet message verification |
| Unauthorized access | RBAC with JWT + API key dual auth |
| Double spending | Idempotency keys and transaction deduplication |
| Oracle manipulation | Multi-source price feeds with deviation checks |
| Flash loan attacks | Time-locked state transitions |

## Audit Status

| Component | Status | Auditor |
|-----------|--------|---------|
| Smart Contracts | 🔜 Planned | TBD |
| API Server | 🔜 Planned | TBD |
| SDK | 🔜 Planned | TBD |

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Active development |

## Bug Bounty

A bug bounty program will be announced after the first external audit. In the interim, we offer public acknowledgment for verified vulnerability reports.
