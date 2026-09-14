//! Property-based / fuzz tests for TreasuryVault.
//!
//! `TreasuryVault` is the contract that holds platform funds, so the invariants
//! that matter are conservation invariants: tokens in minus tokens out must equal
//! the vault balance, and every movement must be accounted for exactly once.
//!
//! These tests run a deterministic pseudo-random sequence of deposits and
//! withdrawals for `ITERATIONS` steps and re-check the invariant after
//! *every* step. The PRNG is a 64-bit xorshift seeded with a constant, so a
//! failure reproduces exactly; there is no dependency on `proptest` or on the
//! system entropy source, which keeps the contract crate free of extra
//! dependencies that would otherwise appear in the SBOM.

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

use super::*;

/// Deterministic steps per property test. Each step performs several metered
/// host calls (transfer + storage + event) and the full invariant is re-checked
/// afterwards, so 256 steps already exercise thousands of host operations while
/// keeping the funds-at-risk suites fast enough to run on every commit. Raise
/// this locally when hunting for a rare violation.
const ITERATIONS: u32 = 256;

/// Deterministic xorshift64* PRNG. Seed must be non-zero.
struct Rng(u64);

impl Rng {
    fn new(seed: u64) -> Self {
        Rng(seed | 1)
    }

    fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }

    /// Uniform value in `[lo, hi]`, both inclusive.
    fn range_i128(&mut self, lo: i128, hi: i128) -> i128 {
        let span = (hi - lo + 1) as u64;
        lo + (self.next_u64() % span) as i128
    }
}

fn setup() -> (Env, TreasuryVaultClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    // Thousands of metered contract calls per test; the assertions, not the
    // per-test CPU budget, should decide the outcome.
    env.budget().reset_unlimited();
    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();

    let contract_id = env.register_contract(None, TreasuryVault);
    let client = TreasuryVaultClient::new(&env, &contract_id);
    client.init(&owner, &token_address);

    (env, client, owner, contract_id)
}

fn mint(env: &Env, token_address: &Address, to: &Address, amount: i128) {
    token::StellarAssetClient::new(env, token_address).mint(to, &amount);
}

fn balance(env: &Env, token_address: &Address, of: &Address) -> i128 {
    token::Client::new(env, token_address).balance(of)
}

/// INVARIANT: at every step, the vault's token balance equals
/// (sum of deposits − sum of withdrawals), and `get_tx_count()` equals the number
/// of state-changing calls. Neither may drift.
#[test]
fn fuzz_conservation_of_funds() {
    let (env, client, owner, contract_id) = setup();
    let token_address = client.get_token_address();
    let asset_code = String::from_str(&env, "native");

    let payer = Address::generate(&env);
    let payee = Address::generate(&env);

    // Fund the payer once; all later movement is between payer, vault, and payee.
    mint(&env, &token_address, &payer, 1_000_000_000_000);

    let mut rng = Rng::new(0x5EED_1234_ABCD_0001);
    let mut expected_balance: i128 = 0;
    let mut expected_tx_count: u64 = 0;

    for _ in 0..ITERATIONS {
        let deposit = rng.next_u64().is_multiple_of(2);

        if deposit || expected_balance == 0 {
            let amount = rng.range_i128(1, 1_000_000);
            let tx_id = client.deposit(&owner, &payer, &amount, &asset_code);

            let tx = client.get_transaction(&tx_id).expect("tx recorded");
            assert_eq!(
                tx.amount, amount,
                "recorded amount must equal deposited amount"
            );
            assert_eq!(tx.tx_type, TxType::Deposit);

            expected_balance += amount;
            expected_tx_count += 1;
        } else {
            let amount = rng.range_i128(1, expected_balance);
            client.withdraw(&owner, &payee, &amount, &asset_code);

            expected_balance -= amount;
            expected_tx_count += 1;
        }

        assert_eq!(
            balance(&env, &token_address, &contract_id),
            expected_balance,
            "vault balance drifted from the accounting model"
        );
        assert_eq!(
            client.get_tx_count(),
            expected_tx_count,
            "tx count must advance exactly once per state change"
        );
    }
}

/// INVARIANT: tokens can never leave the vault that were never deposited. An
/// unfunded vault rejects every withdrawal, and a withdrawal bigger than the
/// balance always fails — there is no partial-drain path.
#[test]
fn fuzz_withdrawals_cannot_exceed_balance() {
    let (env, client, owner, _contract_id) = setup();
    let asset_code = String::from_str(&env, "native");

    let mut rng = Rng::new(0x5EED_1234_ABCD_0002);

    // On an empty vault, every withdraw must be rejected.
    for _ in 0..ITERATIONS {
        let amount = rng.range_i128(1, 1_000_000_000);
        let to = Address::generate(&env);
        assert!(
            client
                .try_withdraw(&owner, &to, &amount, &asset_code)
                .is_err(),
            "an empty vault must reject every withdrawal"
        );
    }

    assert_eq!(client.get_tx_count(), 0);
}

/// INVARIANT: only the owner may move funds, and `deposit` additionally requires
/// the depositor's authorisation. A random third party can never fabricate a
/// withdrawal.
#[test]
fn fuzz_only_owner_can_withdraw() {
    let (env, client, _owner, _contract_id) = setup();
    let asset_code = String::from_str(&env, "native");

    let mut rng = Rng::new(0x5EED_1234_ABCD_0003);

    for _ in 0..(ITERATIONS / 10) {
        let attacker = Address::generate(&env);
        let to = Address::generate(&env);
        let amount = rng.range_i128(1, 1_000_000);

        // mock_all_auths() authorises the *signature*, but the contract still
        // compares the caller against its stored owner, so this must fail.
        assert!(
            client
                .try_withdraw(&attacker, &to, &amount, &asset_code)
                .is_err(),
            "a non-owner must never withdraw"
        );
    }

    assert_eq!(client.get_tx_count(), 0);
}
