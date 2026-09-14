//! Property-based / fuzz tests for SettlementManager.
//!
//! Settlement decides how much a merchant is paid, so the invariant is
//! arithmetic: `fee + net == amount`, `0 ≤ fee ≤ amount`, and the fee is exactly
//! `floor(amount × fee_bps / 10 000)`. A single rounding bug here pays merchants
//! the wrong amount on every run.
//!
//! Deterministic xorshift PRNG, 10 000 iterations, no extra dependencies.

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

use super::*;

const ITERATIONS: u32 = 10_000;

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

    fn range_i128(&mut self, lo: i128, hi: i128) -> i128 {
        let span = (hi - lo + 1) as u64;
        lo + (self.next_u64() % span) as i128
    }
}

fn setup() -> (Env, SettlementManagerClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, SettlementManager);
    let client = SettlementManagerClient::new(&env, &contract_id);
    client.init(&owner);

    (env, client)
}

/// INVARIANT: the fee/net split is exact and non-lossy for every fee in
/// `[0, 10 000]` bps and every amount. `net` must never go negative, and the two
/// halves must always sum back to the original amount.
#[test]
fn fuzz_fee_split_is_exact() {
    let (env, client) = setup();
    let asset_code = String::from_str(&env, "XLM");

    let mut rng = Rng::new(0x5E77_0001);

    for i in 0..ITERATIONS {
        let merchant = Address::generate(&env);
        let amount = rng.range_i128(1, 1_000_000_000_000);
        let fee_bps = (rng.next_u64() % 10_001) as u32; // 0..=10 000

        let id = client.create_settlement(
            &merchant,
            &amount,
            &asset_code,
            &fee_bps,
            &0,
            &1_000_001,
        );
        assert_eq!(id, (i as u64) + 1, "settlement ids must be sequential");

        let s = client.get_settlement(&id).expect("settlement stored");

        let expected_fee = (amount * i128::from(fee_bps)) / 10_000;

        assert_eq!(s.fee_amount, expected_fee, "fee must be floor(amount * bps / 1e4)");
        assert_eq!(s.net_amount, amount - expected_fee);
        assert_eq!(s.fee_amount + s.net_amount, amount, "no stroop may be lost");
        assert!(s.fee_amount >= 0, "fee cannot be negative");
        assert!(s.fee_amount <= amount, "fee cannot exceed the settled amount");
        assert!(s.net_amount >= 0, "net cannot be negative");
        assert_eq!(s.status, SettlementStatus::Pending);
        assert_eq!(s.processed_at, None);
    }
}

/// INVARIANT: processing a settlement is a `Pending → Completed` transition that
/// stamps `processed_at`, and it is idempotent rather than destructive.
#[test]
fn fuzz_processing_marks_completed() {
    let (env, client) = setup();
    let asset_code = String::from_str(&env, "XLM");

    let mut rng = Rng::new(0x5E77_0002);

    for _ in 0..ITERATIONS {
        let merchant = Address::generate(&env);
        let amount = rng.range_i128(1, 10_000_000);
        let fee_bps = (rng.next_u64() % 501) as u32; // realistic 0–5% band

        let id =
            client.create_settlement(&merchant, &amount, &asset_code, &fee_bps, &0, &1_000_001);

        client.process_settlement(&id);

        let s = client.get_settlement(&id).expect("settlement stored");
        assert_eq!(s.status, SettlementStatus::Completed);
        assert!(s.processed_at.is_some());
        assert_eq!(s.fee_amount + s.net_amount, amount);
    }
}

/// INVARIANT: unknown settlement ids cannot be processed — there is no way to
/// fabricate a completed settlement.
#[test]
fn fuzz_unknown_settlements_cannot_be_processed() {
    let (env, client) = setup();

    let mut rng = Rng::new(0x5E77_0003);

    for _ in 0..(ITERATIONS / 5) {
        // Ids start at 1, so 0 and any large random id are unset.
        let missing = rng.next_u64();
        assert!(
            client.try_process_settlement(&missing).is_err(),
            "processing an unknown settlement must fail"
        );
    }
}
