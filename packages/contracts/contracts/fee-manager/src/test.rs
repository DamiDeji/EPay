//! FeeManager tests — Stellar/Soroban

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use super::*;

const DEFAULT_FEE_BPS: u32 = 50; // 0.5%

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
    client.init(&owner, &DEFAULT_FEE_BPS);

    (env, client, owner)
}

#[test]
fn test_initialize() {
    let (_env, client, _owner) = setup_test();

    let config = client.get_config();
    assert_eq!(config.default_fee_bps, DEFAULT_FEE_BPS);
    assert_eq!(config.min_fee_bps, 10);
    assert_eq!(config.max_fee_bps, 500);
    assert_eq!(config.treasury_fee_bps, 50);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, FeeManager);
    let client = FeeManagerClient::new(&env, &contract_id);
    client.init(&owner, &DEFAULT_FEE_BPS);
    client.init(&owner, &DEFAULT_FEE_BPS);
}

#[test]
#[should_panic(expected = "Fee outside allowed bounds")]
fn test_init_rejects_fee_outside_bounds() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, FeeManager);
    let client = FeeManagerClient::new(&env, &contract_id);
    // 1000 bps (10%) exceeds the hardcoded max of 500
    client.init(&owner, &1000u32);
}

#[test]
fn test_set_default_fee() {
    let (env, client, owner) = setup_test();

    client.set_default_fee(&owner, &100u32);

    let config = client.get_config();
    assert_eq!(config.default_fee_bps, 100);

    // Fee calculation follows the new default (1_000_000 * 100 / 10_000 = 10_000)
    assert_eq!(client.calculate_fee(&1_000_000_i128, &None), 10_000);
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_set_default_fee_not_owner() {
    let (env, client, _owner) = setup_test();

    let attacker = Address::generate(&env);
    // Non-owner must not be able to change platform fees
    client.set_default_fee(&attacker, &100u32);
}

#[test]
#[should_panic(expected = "Fee outside allowed bounds")]
fn test_set_default_fee_above_max() {
    let (env, client, owner) = setup_test();
    client.set_default_fee(&owner, &501u32);
}

#[test]
#[should_panic(expected = "Fee outside allowed bounds")]
fn test_set_default_fee_below_min() {
    let (env, client, owner) = setup_test();
    client.set_default_fee(&owner, &9u32);
}

#[test]
fn test_set_default_fee_at_bounds() {
    let (env, client, owner) = setup_test();

    client.set_default_fee(&owner, &10u32);
    assert_eq!(client.get_config().default_fee_bps, 10);

    client.set_default_fee(&owner, &500u32);
    assert_eq!(client.get_config().default_fee_bps, 500);
}

#[test]
fn test_set_merchant_fee_override() {
    let (env, client, owner) = setup_test();

    let merchant = Address::generate(&env);
    let other_merchant = Address::generate(&env);

    client.set_merchant_fee(&owner, &merchant, &200u32);

    // Merchant-specific fee (1_000_000 * 200 / 10_000 = 20_000)
    assert_eq!(
        client.calculate_fee(&1_000_000_i128, &Some(merchant.clone())),
        20_000
    );
    // Other merchants fall back to the default (1_000_000 * 50 / 10_000 = 5_000)
    assert_eq!(
        client.calculate_fee(&1_000_000_i128, &Some(other_merchant)),
        5_000
    );
    // No merchant also falls back to the default
    assert_eq!(client.calculate_fee(&1_000_000_i128, &None), 5_000);
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_set_merchant_fee_not_owner() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);
    client.set_merchant_fee(&attacker, &merchant, &200u32);
}

#[test]
#[should_panic(expected = "Fee outside allowed bounds")]
fn test_set_merchant_fee_above_max() {
    let (env, client, owner) = setup_test();

    let merchant = Address::generate(&env);
    client.set_merchant_fee(&owner, &merchant, &501u32);
}

#[test]
fn test_calculate_fee_default() {
    let (env, client, _owner) = setup_test();

    assert_eq!(client.calculate_fee(&1_000_000_i128, &None), 5_000); // 1M * 50 / 10k
    assert_eq!(client.calculate_fee(&10_000_000_i128, &None), 50_000); // 10M * 50 / 10k
    assert_eq!(client.calculate_fee(&1_i128, &None), 0); // 1 * 50 / 10k truncates to 0
    assert_eq!(client.calculate_fee(&0_i128, &None), 0);
}

#[test]
fn test_calculate_fee_rounds_down() {
    let (env, client, _owner) = setup_test();

    // Integer division truncates toward zero — 3 stroops * 50 / 10_000 = 0
    assert_eq!(client.calculate_fee(&3_i128, &None), 0);
    // 201 * 50 / 10_000 = 1 (truncated)
    assert_eq!(client.calculate_fee(&201_i128, &None), 1);
}

#[test]
#[should_panic(expected = "overflow")]
fn test_calculate_fee_overflow_panics() {
    let (env, client, _owner) = setup_test();

    // `amount * fee_bps` overflows i128 for extreme amounts. Checked arithmetic
    // must panic (in both debug and release builds) instead of silently wrapping.
    client.calculate_fee(&i128::MAX, &None);
}
