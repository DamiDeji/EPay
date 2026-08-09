# EPay Roadmap

This roadmap outlines EPay's development trajectory over the next 6 months. Milestones marked with 🎯 are explicitly tied to requested grant funding from the Stellar Community Fund (SCF) Wave 8.

---

## Phase 1: Testnet Launch & Audit Prep (Month 1–2)

**Goal**: Deploy all 12 Soroban contracts to Stellar testnet, stabilize the API, and prepare for external audit.

| Milestone | Status | Grant Funded |
|-----------|--------|:---:|
| Deploy all 12 contracts to Stellar testnet | 🚧 In Progress | — |
| Public testnet demo with live contract addresses | 🚧 In Progress | — |
| End-to-end integration test suite (contracts → indexer → API → dashboards) | 🔜 Planned | 🎯 |
| Contract security review checklist & internal audit | ✅ Complete | — |
| External smart contract audit (3rd party) | 🔜 Planned | 🎯 |
| Publish live testnet deployment to `DEPLOYMENTS.md` | 🔜 Planned | — |

---

## Phase 2: Mainnet Alpha (Month 2–4)

**Goal**: Launch EPay on Stellar mainnet with a controlled merchant alpha.

| Milestone | Status | Grant Funded |
|-----------|--------|:---:|
| Mainnet contract deployment & verification | 🔜 Planned | 🎯 |
| Mainnet API with production infrastructure | 🔜 Planned | — |
| Onboard 10–20 alpha merchants | 🔜 Planned | — |
| Production-grade monitoring & alerting (Sentry, Grafana) | 🔜 Planned | 🎯 |
| SDK v1.0 release with stable API | 🔜 Planned | — |
| Merchant onboarding flow with KYC integration | 🔜 Planned | 🎯 |
| Stellar asset support (USDC on Stellar, yXLM, etc.) | 🔜 Planned | 🎯 |

---

## Phase 3: Growth & Ecosystem (Month 4–6)

**Goal**: Scale to 100+ merchants, expand asset support, and integrate deeply with the Stellar ecosystem.

| Milestone | Status | Grant Funded |
|-----------|--------|:---:|
| 100+ active merchants on platform | 🔜 Planned | — |
| Stellar SEP-24 anchor integration for fiat on/off-ramps | 🔜 Planned | 🎯 |
| Payment Link embed widget (drop-in for any website) | 🔜 Planned | 🎯 |
| Mobile SDK (React Native) for in-app payments | 🔜 Planned | 🎯 |
| Soroban event-driven webhook reliability improvements | 🔜 Planned | — |
| Community bounty program for bug reports & contributions | 🔜 Planned | 🎯 |
| DAO governance exploration for protocol fee parameters | 🔜 Planned | — |

---

## Grant Funding Use

If awarded SCF Wave 8 funding, the grant will directly support:

| Category | Allocation | Deliverable |
|----------|-----------|-------------|
| **External Smart Contract Audit** | ~40% | Third-party audit of all 12 Soroban contracts by a reputable firm |
| **Infrastructure & DevOps** | ~25% | Production hosting, monitoring, CI/CD hardening for mainnet |
| **Developer Tooling** | ~20% | SDK v1.0, mobile SDK, payment embed widget, API documentation |
| **Community & Adoption** | ~15% | Bug bounty program, merchant onboarding support, tutorials & guides |

---

## Key Principles

- **Security-first**: No mainnet launch without an external audit. The escrow, treasury, and fee contracts (handling real funds) must be verified by a third party before going live.
- **Real merchants, real feedback**: Every feature is built in response to merchant needs, not speculation.
- **Ecosystem alignment**: EPay is built for Stellar. All tooling and integrations target the Stellar/Soroban ecosystem first.
- **Open source, always**: The entire codebase remains MIT-licensed. Grant funding accelerates development without changing the project's open-source commitment.
