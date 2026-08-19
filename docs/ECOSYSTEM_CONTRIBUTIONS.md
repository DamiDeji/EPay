# Building Presence in the Stellar / Soroban Ecosystem

Drips Wave's relevance check weighs **"maintainer activity in the respective ecosystem."**
For a new maintainer, the fastest way to satisfy this is to contribute to established
Stellar/Soroban projects — opening and reviewing pull requests in _other_ repositories, not
just your own.

> Note: the Drips contributor scorecard only counts **collaborative** pull requests — PRs
> that received at least one comment or review. Self-merges and automated dependency bumps
> are filtered out. The same principle applies to how maintainer activity is perceived.

## Repositories to target

Stellar has consolidated several repositories over time. Verify current names and the
`good first issue` label at https://github.com/stellar before starting.

### Start here (low barrier, high relevance to EPay)

| Repo                       | Language     | Why it fits EPay                                                |
| -------------------------- | ------------ | --------------------------------------------------------------- |
| `stellar/stellar-docs`     | MDX/Markdown | Documentation fixes are approachable and build trust            |
| `stellar/soroban-examples` | Rust         | Example Soroban contracts — EPay already writes these           |
| `stellar/quickstart`       | Docker/Shell | Local Stellar + Soroban environment used by EPay's own dev flow |

### SDKs and libraries (directly overlaps EPay's stack)

| Repo                                             | Language   | Why it fits EPay                                   |
| ------------------------------------------------ | ---------- | -------------------------------------------------- |
| `stellar/js-stellar-sdk` (and `js-stellar-base`) | TypeScript | EPay's SDK and indexer depend on these             |
| `stellar/rs-soroban-sdk`                         | Rust       | EPay's 12 contracts are written against this SDK   |
| `stellar/rs-soroban-env`                         | Rust       | The Soroban host environment under the SDK         |
| `stellar/stellar-cli`                            | Rust       | The CLI EPay's CI uses to build/optimize contracts |

### Core infrastructure (deeper, higher-impact)

| Repo                   | Language | Why it fits EPay                                      |
| ---------------------- | -------- | ----------------------------------------------------- |
| `stellar/go`           | Go       | Horizon and other services; the indexer reads Horizon |
| `stellar/stellar-core` | C++      | Core consensus node; highest barrier, largest impact  |
| `stellar/stellar-etl`  | Python   | Blockchain ETL; relevant to EPay's indexing concerns  |

### Tooling / surfaces

| Repo                     | Language   | Why it fits EPay                  |
| ------------------------ | ---------- | --------------------------------- |
| `stellar/laboratory`     | TypeScript | Transaction building/debugging UI |
| `stellar/account-viewer` | TypeScript | Wallet/account inspection         |

## Suggested strategy (in order)

1. **Fix docs and examples first.** One or two merged PRs to `stellar-docs` and
   `soroban-examples` establish a public record of collaborative contribution with minimal
   risk.
2. **Contribute upstream fixes in code you already touch.** If EPay's indexer or SDK works
   around a bug or gap in `js-stellar-sdk` or `stellar/go`, contribute the fix upstream.
3. **Review others' PRs.** The scorecard counts reviews; leaving substantive reviews on
   Soroban/Stellar PRs counts as ecosystem activity and raises visibility.
4. **Open issues** for real bugs you encounter — the scorecard counts issues opened.
5. **Engage in discussions** (GitHub Discussions, Stellar Dev Discord) to build
   recognition as an active ecosystem member.

## Tracking

Keep a short log here as you make contributions, so the appeal and future applications can
cite specific, verifiable activity:

| Date | Repo | PR/Issue | Outcome |
| ---- | ---- | -------- | ------- |
|      |      |          |         |
|      |      |          |         |
