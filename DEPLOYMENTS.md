# EPay Contract Deployments

> **Last updated**: August 9, 2026  
> **Network**: Stellar Testnet ("Test SDF Network ; September 2015")  
> **Deployer**: `GBQJ46YRGJ5ZGPKEP2ABVXYP6DQTZJ5BE2CWFNJX767RROLURAMEXYSS`  
> **stellar-cli**: v23.0.1

---

## Contract Addresses (Testnet)

| # | Contract | Testnet Address | Explorer Link | Deployment Date |
|---|----------|----------------|---------------|-----------------|
| 1 | `PaymentRouter` | `CAADW6IXJG5NNEAN5EVH46MYKTH7PHH5ZL3EGOZCYOCT5MV35MHWL57X` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAADW6IXJG5NNEAN5EVH46MYKTH7PHH5ZL3EGOZCYOCT5MV35MHWL57X) | 2026-08-09 |
| 2 | `InvoiceManager` | `CB2RM742IUJH4O25AADZS4EBPDQGEMZP3DKZYT42IZPR3O2US5ZTJDCE` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CB2RM742IUJH4O25AADZS4EBPDQGEMZP3DKZYT42IZPR3O2US5ZTJDCE) | 2026-08-09 |
| 3 | `EscrowManager` | `CBZ7XLC4G3S2BCSM5UAMSUVY6Z6PH4RPSOIVRDQM3VRYDX36KHNYBAWO` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBZ7XLC4G3S2BCSM5UAMSUVY6Z6PH4RPSOIVRDQM3VRYDX36KHNYBAWO) | 2026-08-09 |
| 4 | `RefundManager` | `CBKOGVRUMV7RFLBXBKGGVOJ2UTU7NPPKD3BAXIE3CPGO4XXOHA323ENX` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBKOGVRUMV7RFLBXBKGGVOJ2UTU7NPPKD3BAXIE3CPGO4XXOHA323ENX) | 2026-08-09 |
| 5 | `SubscriptionManager` | `CD77VJ7PH3QK34LLRZIKNHHI244VVG2SF6H2L6HH24F5DR655RUZ2GJC` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CD77VJ7PH3QK34LLRZIKNHHI244VVG2SF6H2L6HH24F5DR655RUZ2GJC) | 2026-08-09 |
| 6 | `SettlementManager` | `CABZK4T3EIBLWFPHIWIQGRGRV7M3UKSWMO377ILSIDSXWTZQBWRB7X2B` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CABZK4T3EIBLWFPHIWIQGRGRV7M3UKSWMO377ILSIDSXWTZQBWRB7X2B) | 2026-08-09 |
| 7 | `MerchantRegistry` | `CAVLP7ILDSD76JEHKV25QYOCZUOI344LMIV3EH4ITZJZSE3JC77Z4VJR` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAVLP7ILDSD76JEHKV25QYOCZUOI344LMIV3EH4ITZJZSE3JC77Z4VJR) | 2026-08-09 |
| 8 | `TreasuryVault` | `CBOGYATCRKGA2CDGZDDVLSC6OZTQVTIF3BWG5AYSWQ34O4WPPEYHF4SZ` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBOGYATCRKGA2CDGZDDVLSC6OZTQVTIF3BWG5AYSWQ34O4WPPEYHF4SZ) | 2026-08-09 |
| 9 | `FeeManager` | `CBAZ32US4A6NAN77RMDYFU3JBUFQ3YQXW5T5H6C4YCZCSCMMM3POT4GU` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBAZ32US4A6NAN77RMDYFU3JBUFQ3YQXW5T5H6C4YCZCSCMMM3POT4GU) | 2026-08-09 |
| 10 | `ConfigurationManager` | `CBBUAFWCJMCGKSZMF3YHQJMFVRB5JJPRIAXS4SVVH3AI44CFCQ3YGTZG` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBBUAFWCJMCGKSZMF3YHQJMFVRB5JJPRIAXS4SVVH3AI44CFCQ3YGTZG) | 2026-08-09 |
| 11 | `EmergencyPause` | `CBY35OQLTFGXUQ2PKGQSBBQMSJHJPAD7OKRIH64WP2YJ5IRWPSHV3HXN` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBY35OQLTFGXUQ2PKGQSBBQMSJHJPAD7OKRIH64WP2YJ5IRWPSHV3HXN) | 2026-08-09 |
| 12 | `RoleManager` | `CBN2XTKPY5BMZTM7JBSLTSL3WSIZJYEKNQ4N6YIS3G3YF7JMIX7LAN4K` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBN2XTKPY5BMZTM7JBSLTSL3WSIZJYEKNQ4N6YIS3G3YF7JMIX7LAN4K) | 2026-08-09 |

---

## How to Re-Deploy

### Prerequisites

```bash
# Install stellar-cli
cargo install stellar-cli --locked
# Or download pre-built binary from GitHub releases

# Configure testnet identity
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet
```

### Build & Optimize

```bash
cd packages/contracts

# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# Optimize each WASM (stellar-cli v23+ saves .optimized.wasm alongside input)
for wasm in target/wasm32-unknown-unknown/release/*.wasm; do
  stellar contract optimize --wasm "$wasm"
done

# Collect optimized files
mkdir -p optimized
cp target/wasm32-unknown-unknown/release/*.optimized.wasm optimized/
```

### Deploy

```bash
# Deploy a single contract
stellar contract deploy \
  --wasm optimized/payment_router.optimized.wasm \
  --source deployer \
  --network testnet

# Deploy all
for wasm in optimized/*.optimized.wasm; do
  stellar contract deploy --wasm "$wasm" --source deployer --network testnet
done
```

---

## Interacting with Deployed Contracts

```bash
# Example: check if a contract is deployed
stellar contract info \
  --id CAADW6IXJG5NNEAN5EVH46MYKTH7PHH5ZL3EGOZCYOCT5MV35MHWL57X \
  --network testnet

# Example: invoke a contract function
stellar contract invoke \
  --id CAADW6IXJG5NNEAN5EVH46MYKTH7PHH5ZL3EGOZCYOCT5MV35MHWL57X \
  --source deployer \
  --network testnet \
  -- initialize --admin GBQJ46YRGJ5ZGPKEP2ABVXYP6DQTZJ5BE2CWFNJX767RROLURAMEXYSS
```
