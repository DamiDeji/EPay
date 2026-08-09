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
| Signature forgery | Stellar wallet message verification |
| Unauthorized access | RBAC with JWT + API key dual auth |
| Double spending | Idempotency keys and transaction deduplication |
| Oracle manipulation | Multi-source price feeds with deviation checks |
| Flash loan attacks | Time-locked state transitions |

## Audit Status

**No formal third-party audit has been conducted yet.** EPay is in active development (v0.1.x) and has not undergone an external security audit. A comprehensive third-party audit of all 12 Soroban smart contracts — especially the high-risk contracts handling fund custody (`EscrowManager`, `RefundManager`, `TreasuryVault`, `FeeManager`) — is a top priority and is explicitly included in our grant funding request.

| Component | Status | Auditor | Notes |
|-----------|--------|---------|-------|
| Smart Contracts | 🔜 Planned | TBD | Audit funding requested in SCF Wave 8 grant application |
| API Server | 🔜 Planned | TBD | To follow smart contract audit |
| SDK | 🔜 Planned | TBD | To follow API audit |

### Internal Security Review

Prior to external audit, the following internal review checklist has been completed against all 12 contracts:

- [x] **Authorization checks** — All state-mutating functions verify caller permissions via `RoleManager`
- [x] **Reentrancy protection** — Checks-effects-interactions pattern applied to all fund-transferring operations
- [x] **Integer overflow/underflow** — All arithmetic uses safe math; Soroban SDK provides built-in overflow protection
- [x] **Access control** — Role-based access control with Admin, Merchant, Customer, and Developer roles
- [x] **Input validation** — All public entry points validate parameters before state mutation
- [x] **Emergency pause** — `EmergencyPause` contract provides circuit-breaker capability across all contracts
- [x] **Event emission** — All state changes emit structured events for off-chain indexing and audit trails
- [x] **Fee calculation integrity** — Fee tiers are owner-configurable with max-fee-bps cap (500 bps = 5%)
- [x] **Settlement minimums** — Configurable minimum settlement amounts prevent dust attacks
- [x] **Payment expiry** — All payments have a configurable timeout (default: 1 hour)
- [x] **Idempotency** — Transaction deduplication via idempotency keys in the API layer
- [x] **Rate limiting** — Auth and payment endpoints are rate-limited at the API gateway

## Responsible Disclosure

We follow a coordinated disclosure process:

1. **Report**: Send vulnerability details to `security@epay.dev` (do not use public issues)
2. **Acknowledge**: We'll respond within 48 hours confirming receipt
3. **Triage**: We'll assess severity and scope within 5 business days
4. **Fix**: We'll develop and test a fix (timeline based on severity)
5. **Disclose**: We'll publish a security advisory after the fix is deployed

### What to Include in a Report

- Detailed description of the vulnerability
- Steps to reproduce (including environment details)
- Affected components and versions
- Potential impact and severity assessment
- Any suggested mitigations
- Your contact information for follow-up

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Active development |

## Bug Bounty

A bug bounty program will be announced after the first external audit. In the interim, we offer public acknowledgment for verified vulnerability reports.
