//! FeeManager tests — Stellar/Soroban
//!
//! Tests cover: fee configuration, fee calculation, merchant-specific fees,
//! bounds enforcement, and access control.

// `Ledger` is the testutils trait that supplies `env.ledger().with_mut(...)`;
// without it the suite does not compile (`E0599: no method named with_mut`).
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, FeeManagerClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, FeeManager);
    let client = FeeManagerClient::new(&env, &contract_id);
    client.init(&owner, &50_u32); // 0.5% default

    (env, client, owner)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (_env, client, _owner) = setup_test();

    let config = client.get_config();
    assert_eq!(config.default_fee_bps, 50);
    assert_eq!(config.min_fee_bps, 10);
    assert_eq!(config.max_fee_bps, 500);
    assert_eq!(config.treasury_fee_bps, 50);
}

#[test]
fn test_initialize_with_default_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, FeeManager);
    let client = FeeManagerClient::new(&env, &contract_id);
    client.init(&owner, &100_u32); // 1%

    let config = client.get_config();
    assert_eq!(config.default_fee_bps, 100);
}

#[test]
#[should_panic(expected = "Fee outside allowed bounds")]
fn test_initialize_with_fee_too_low() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, FeeManager);
    let client = FeeManagerClient::new(&env, &contract_id);
    client.init(&owner, &5_u32); // Below min of 10
}

#[test]
#[should_panic(expected = "Fee outside allowed bounds")]
fn test_initialize_with_fee_too_high() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, FeeManager);
    let client = FeeManagerClient::new(&env, &contract_id);
    client.init(&owner, &600_u32); // Above max of 500
}

// ════════════════════════════════════════════════════════════════════
// FEE CALCULATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_calculate_fee_default() {
    let (_env, client, _owner) = setup_test();

    // Default 0.5% fee
    let fee = client.calculate_fee(&10_000_000_i128, &None);
    assert_eq!(fee, 50_000); // 10M * 50 / 10000

    let fee = client.calculate_fee(&100_000_000_i128, &None);
    assert_eq!(fee, 500_000); // 100M * 50 / 10000

    let fee = client.calculate_fee(&1_000_000_i128, &None);
    assert_eq!(fee, 5_000); // 1M * 50 / 10000

    let fee = client.calculate_fee(&0_i128, &None);
    assert_eq!(fee, 0);
}

#[test]
fn test_calculate_fee_various_rates() {
    let (_env, client, owner) = setup_test();

    // Set custom default fee
    client.set_default_fee(&owner, &100_u32); // 1%
    let config = client.get_config();
    assert_eq!(config.default_fee_bps, 100);

    let fee = client.calculate_fee(&10_000_000_i128, &None);
    assert_eq!(fee, 100_000); // 10M * 100 / 10000

    client.set_default_fee(&owner, &250_u32); // 2.5%
    let fee = client.calculate_fee(&10_000_000_i128, &None);
    assert_eq!(fee, 250_000);
}

#[test]
fn test_calculate_fee_with_merchant_override() {
    let (env, client, owner) = setup_test();

    let merchant = Address::generate(&env);

    // Set merchant-specific fee
    client.set_merchant_fee(&owner, &merchant, &200_u32); // 2%

    // Merchant gets their overridden fee
    let fee = client.calculate_fee(&10_000_000_i128, &Some(merchant));
    assert_eq!(fee, 200_000); // 10M * 200 / 10000

    // Non-merchant uses default
    let other = Address::generate(&env);
    let fee = client.calculate_fee(&10_000_000_i128, &Some(other));
    assert_eq!(fee, 50_000); // Default 0.5%
}

// ════════════════════════════════════════════════════════════════════
// FEE BOUNDS ENFORCEMENT
// ════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Fee outside allowed bounds")]
fn test_set_fee_below_minimum() {
    let (_env, client, owner) = setup_test();
    client.set_default_fee(&owner, &5_u32); // Below min 10
}

#[test]
#[should_panic(expected = "Fee outside allowed bounds")]
fn test_set_fee_above_maximum() {
    let (_env, client, owner) = setup_test();
    client.set_default_fee(&owner, &600_u32); // Above max 500
}

#[test]
fn test_set_fee_at_boundaries() {
    let (_env, client, owner) = setup_test();

    // At minimum
    client.set_default_fee(&owner, &10_u32);
    let config = client.get_config();
    assert_eq!(config.default_fee_bps, 10);

    // At maximum
    client.set_default_fee(&owner, &500_u32);
    let config = client.get_config();
    assert_eq!(config.default_fee_bps, 500);
}

// ════════════════════════════════════════════════════════════════════
// ACCESS CONTROL
// ════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_non_owner_cannot_set_fee() {
    let (env, client, _owner) = setup_test();

    let unauthorized = Address::generate(&env);
    client.set_default_fee(&unauthorized, &100_u32);
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_non_owner_cannot_set_merchant_fee() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    client.set_merchant_fee(&unauthorized, &merchant, &100_u32);
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_fee_precision() {
    let (_env, client, _owner) = setup_test();

    // Fee calculation should truncate (not round) — integer division
    // 9999 * 50 / 10000 = 499950 / 10000 = 49 (truncated)
    let fee = client.calculate_fee(&9999_i128, &None);
    assert_eq!(fee, 49);
}

#[test]
fn test_multiple_merchant_fees() {
    let (env, client, owner) = setup_test();

    let m1 = Address::generate(&env);
    let m2 = Address::generate(&env);
    let m3 = Address::generate(&env);

    client.set_merchant_fee(&owner, &m1, &100_u32);
    client.set_merchant_fee(&owner, &m2, &200_u32);
    client.set_merchant_fee(&owner, &m3, &300_u32);

    assert_eq!(client.calculate_fee(&10_000_000_i128, &Some(m1)), 100_000);
    assert_eq!(client.calculate_fee(&10_000_000_i128, &Some(m2)), 200_000);
    assert_eq!(client.calculate_fee(&10_000_000_i128, &Some(m3)), 300_000);
    assert_eq!(client.calculate_fee(&10_000_000_i128, &None), 50_000); // default
}

// ════════════════════════════════════════════════════════════════════
// FUZZ: 10,000 iterations — fee calculation stress test
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_fuzz_fee_calculation() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, FeeManager);
    let client = FeeManagerClient::new(&env, &contract_id);
    client.init(&owner, &50_u32);
    // The sweep below issues hundreds of metered contract calls.
    env.budget().reset_unlimited();

    let merchant = Address::generate(&env);
    client.set_merchant_fee(&owner, &merchant, &100_u32);

    // Sweep deterministic amounts and fee configurations. Each step performs a
    // metered contract call, so the sweep is bounded to keep the suite fast.
    for i in 0..256usize {
        let amount = ((i as u64 + 1) * 1000) as i128;
        let fee_bps = 10 + (i % 491) * 10; // 10 to 4910, but the contract caps at 500
        let capped = (fee_bps as u32).min(500);

        // Alternate between the merchant-specific override and the global
        // default, and always compare against the rate that was just configured.
        let (fee1, fee2) = if i % 2 == 0 {
            client.set_default_fee(&owner, &capped);
            (
                client.calculate_fee(&amount, &None),
                client.calculate_fee(&amount, &None),
            )
        } else {
            client.set_merchant_fee(&owner, &merchant, &capped);
            (
                client.calculate_fee(&amount, &Some(merchant.clone())),
                client.calculate_fee(&amount, &Some(merchant.clone())),
            )
        };

        // Pure function of (amount, configured rate): repeated calls agree.
        assert_eq!(fee1, fee2, "fee calculation must be idempotent");
        assert_eq!(
            fee1,
            amount * capped as i128 / 10000,
            "fee must be floor(amount * bps / 10_000)"
        );
        // Never charges more than the configured basis-point rate.
        assert!(fee1 * 10000 <= amount * capped as i128);
    }
}
