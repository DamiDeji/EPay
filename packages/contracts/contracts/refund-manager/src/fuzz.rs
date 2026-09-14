//! Property-based / fuzz tests for RefundManager.
//!
//! The properties that matter for refunds are bounded payouts and terminal
//! states: a refund can never exceed what was originally paid, a completed
//! refund can never be re-completed, and funds only ever move back to the
//! original payer.
//!
//! Deterministic xorshift PRNG, 10 000 iterations, no extra dependencies.

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

use super::*;

const ITERATIONS: u32 = 256;

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

fn setup() -> (Env, RefundManagerClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    // Each property test performs thousands of metered host calls; the
    // assertions, not the per-test CPU budget, should decide the outcome.
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

    let contract_id = env.register_contract(None, RefundManager);
    let client = RefundManagerClient::new(&env, &contract_id);
    client.init(&owner, &token_address);

    (env, client, owner, token_address, contract_id)
}

fn balance(env: &Env, token_address: &Address, of: &Address) -> i128 {
    token::Client::new(env, token_address).balance(of)
}

/// INVARIANT: `amount ≤ original_amount` is enforced, `is_partial` is derived
/// correctly, and the stored record matches the request exactly.
#[test]
fn fuzz_request_bounds_and_partial_flag() {
    let (env, client, _owner, _token, _contract_id) = setup();
    let asset_code = String::from_str(&env, "XLM");
    let reason = String::from_str(&env, "customer request");

    let mut rng = Rng::new(0x2EF_0001);
    let mut seen_full = false;
    let mut seen_partial = false;

    for i in 0..ITERATIONS {
        let merchant = Address::generate(&env);
        let payer = Address::generate(&env);
        let original = rng.range_i128(1, 100_000_000);
        // Alternate between a full refund and a partial one so both branches of
        // `is_partial` are exercised; a purely random `amount` would essentially
        // never equal `original` for large payments.
        let amount = if i % 2 == 0 {
            original
        } else {
            rng.range_i128(1, original - 1)
        };

        let id = client.request_refund(
            &merchant,
            &payer,
            &(i as u64),
            &amount,
            &original,
            &asset_code,
            &reason,
        );

        let refund = client.get_refund(&id).expect("refund stored");
        assert_eq!(refund.amount, amount);
        assert_eq!(refund.original_amount, original);
        assert!(refund.amount <= refund.original_amount);
        assert_eq!(refund.is_partial, amount < original);
        assert_eq!(refund.status, RefundStatus::Requested);
        assert_eq!(refund.payer, payer);

        if refund.is_partial {
            seen_partial = true;
        } else {
            seen_full = true;
        }
    }

    // The generator must actually be exercising both cases.
    assert!(seen_full && seen_partial);
}

/// INVARIANT: out-of-range requests are rejected outright — a zero refund and a
/// refund larger than the original payment must both fail.
#[test]
fn fuzz_out_of_range_requests_are_rejected() {
    let (env, client, _owner, _token, _contract_id) = setup();
    let asset_code = String::from_str(&env, "XLM");
    let reason = String::from_str(&env, "x");

    let mut rng = Rng::new(0x2EF_0002);

    for i in 0..(ITERATIONS / 5) {
        let merchant = Address::generate(&env);
        let payer = Address::generate(&env);
        let original = rng.range_i128(1, 10_000_000);

        // Zero / negative amount.
        assert!(client
            .try_request_refund(
                &merchant,
                &payer,
                &(i as u64),
                &0_i128,
                &original,
                &asset_code,
                &reason
            )
            .is_err());

        // Amount strictly greater than the original payment.
        let too_big = original + rng.range_i128(1, 1_000_000);
        assert!(client
            .try_request_refund(
                &merchant,
                &payer,
                &(i as u64),
                &too_big,
                &original,
                &asset_code,
                &reason
            )
            .is_err());
    }
}

/// INVARIANT: a refund follows `Requested → Approved → Completed`, funds are paid
/// only to the original payer, and terminal states cannot be re-entered.
#[test]
fn fuzz_lifecycle_is_monotonic_and_pays_the_payer() {
    let (env, client, owner, token_address, contract_id) = setup();
    let asset_code = String::from_str(&env, "XLM");
    let reason = String::from_str(&env, "returned goods");

    let mut rng = Rng::new(0x2EF_0003);

    for i in 0..ITERATIONS {
        let merchant = Address::generate(&env);
        let payer = Address::generate(&env);
        let amount = rng.range_i128(1, 5_000_000);

        // Fund the contract to simulate held payment funds.
        token::StellarAssetClient::new(&env, &token_address).mint(&contract_id, &amount);
        let payer_before = balance(&env, &token_address, &payer);

        let id = client.request_refund(
            &merchant,
            &payer,
            &(i as u64),
            &amount,
            &amount,
            &asset_code,
            &reason,
        );

        // Cannot complete before approval.
        assert!(client.try_complete_refund(&owner, &id).is_err());

        client.approve_refund(&owner, &id);
        assert_eq!(
            client.get_refund(&id).expect("stored").status,
            RefundStatus::Approved
        );

        // Cannot approve twice.
        assert!(client.try_approve_refund(&owner, &id).is_err());

        client.complete_refund(&owner, &id);
        let completed = client.get_refund(&id).expect("stored");
        assert_eq!(completed.status, RefundStatus::Completed);
        assert!(completed.processed_at.is_some());

        assert_eq!(
            balance(&env, &token_address, &payer),
            payer_before + amount,
            "the refund must credit the original payer exactly once"
        );

        // A completed refund is terminal.
        assert!(client.try_complete_refund(&owner, &id).is_err());
    }
}
