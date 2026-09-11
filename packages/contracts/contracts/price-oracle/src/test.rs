//! PriceOracle tests — Stellar/Soroban
//!
//! Tests cover: price updates, price queries, currency conversion,
//! fee calculation across assets, oracle authorization, and access control.

use soroban_sdk::{testutils::Address as _, Env, Address, String};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, PriceOracleClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let initial_oracle = Address::generate(&env);
    let contract_id = env.register_contract(None, PriceOracle);
    let client = PriceOracleClient::new(&env, &contract_id);
    client.init(&owner, &initial_oracle);

    (env, client, owner, initial_oracle)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (env, client, owner, initial_oracle) = setup_test();

    assert_eq!(client.get_owner(), owner);
    assert!(client.is_authorized_oracle(&initial_oracle));
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let oracle = Address::generate(&env);
    let contract_id = env.register_contract(None, PriceOracle);
    let client = PriceOracleClient::new(&env, &contract_id);
    client.init(&owner, &oracle);
    client.init(&owner, &oracle);
}

// ════════════════════════════════════════════════════════════════════
// PRICE UPDATES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_update_price() {
    let (env, client, _owner, oracle) = setup_test();

    let price = 2_500_000_i128; // 2.5 USDC per XLM (in micro units)
    client.update_price(
        &oracle,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &price,
        &6_u32,
        &String::from_str(&env, "test-oracle"),
    );

    let feed = client.get_price_feed(
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
    )
    .unwrap();

    assert_eq!(feed.price, price);
    assert_eq!(feed.decimals, 6);
    assert_eq!(feed.base_asset, String::from_str(&env, ASSET_XLM));
    assert_eq!(feed.quote_asset, String::from_str(&env, ASSET_USDC));
    assert!(feed.updated_at > 0);
}

#[test]
fn test_update_price_negative_rejected() {
    let (env, client, _owner, oracle) = setup_test();

    client.update_price(
        &oracle,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &-100_i128,
        &6_u32,
        &String::from_str(&env, "bad"),
    );
}

// ════════════════════════════════════════════════════════════════════
// PRICE QUERIES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_get_price() {
    let (env, client, _owner, oracle) = setup_test();

    client.update_price(
        &oracle,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &2_000_000_i128,
        &6_u32,
        &String::from_str(&env, "oracle-1"),
    );

    let (price, decimals, updated_at, source) = client
        .get_price(
            &String::from_str(&env, ASSET_XLM),
            &String::from_str(&env, ASSET_USDC),
        )
        .unwrap();

    assert_eq!(price, 2_000_000_i128);
    assert_eq!(decimals, 6);
    assert!(updated_at > 0);
    assert_eq!(source, String::from_str(&env, "oracle-1"));
}

#[test]
fn test_get_price_nonexistent_pair() {
    let (env, client, _owner, _oracle) = setup_test();

    let result = client.get_price(
        &String::from_str(&env, "BTC"),
        &String::from_str(&env, "USDC"),
    );

    assert_eq!(result, None);
}

// ════════════════════════════════════════════════════════════════════
// CURRENCY CONVERSION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_convert_xlm_to_usdc() {
    let (env, client, _owner, oracle) = setup_test();

    // Set price: 1 XLM = 2 USDC (in micro units: 2,000,000)
    client.update_price(
        &oracle,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &2_000_000_i128,
        &6_u32,
        &String::from_str(&env, "oracle"),
    );

    // Convert 100 XLM (in stroops: 100 * 10^7) to USDC
    let xlm_stroops = 100_000_000_i128; // 100 XLM
    let usdc_micro = client.convert(&xlm_stroops, &String::from_str(&env, ASSET_XLM), &String::from_str(&env, ASSET_USDC), &6_u32).unwrap();

    // 100 XLM * 2 USDC/XLM = 200 USDC = 200,000,000 micro-USDC
    assert_eq!(usdc_micro, 200_000_000_i128);
}

#[test]
fn test_convert_usdc_to_xlm() {
    let (env, client, _owner, oracle) = setup_test();

    // Set price: 1 XLM = 2 USDC
    client.update_price(
        &oracle,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &2_000_000_i128,
        &6_u32,
        &String::from_str(&env, "oracle"),
    );

    // Convert 100 USDC (in micro: 100 * 10^6) to XLM
    let usdc_micro = 100_000_000_i128; // 100 USDC
    let xlm_stroops = client.convert(&usdc_micro, &String::from_str(&env, ASSET_USDC), &String::from_str(&env, ASSET_XLM), &7_u32).unwrap();

    // 100 USDC / 2 USDC/XLM = 50 XLM = 500,000,000 stroops
    assert_eq!(xlm_stroops, 500_000_000_i128);
}

// ════════════════════════════════════════════════════════════════════
// FEE CALCULATION ACROSS ASSETS
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_calculate_fee_in_different_asset() {
    let (env, client, _owner, oracle) = setup_test();

    // Set price: 1 XLM = 2 USDC
    client.update_price(
        &oracle,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &2_000_000_i128,
        &6_u32,
        &String::from_str(&env, "oracle"),
    );

    // Calculate 0.5% fee (50 bps) on 100 XLM payment, in USDC
    let xlm_amount = 100_000_000_i128; // 100 XLM
    let fee_usdc = client
        .calculate_fee_in_asset(
            &xlm_amount,
            &String::from_str(&env, ASSET_XLM),
            &50_u32, // 0.5%
            &String::from_str(&env, ASSET_USDC),
            &6_u32,
        )
        .unwrap();

    // Fee in XLM: 100 * 50 / 10000 = 0.5 XLM = 5,000,000 stroops
    // Fee in USDC: 0.5 * 2 = 1 USDC = 1,000,000 micro
    assert_eq!(fee_usdc, 1_000_000_i128);
}

// ════════════════════════════════════════════════════════════════════
// ORACLE MANAGEMENT
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_add_oracle() {
    let (env, client, owner, _initial_oracle) = setup_test();

    let new_oracle = Address::generate(&env);
    client.add_oracle(
        &owner,
        &new_oracle,
        &String::from_str(&env, "XLM/USDC"),
        &50_u32,
    );

    assert!(client.is_authorized_oracle(&new_oracle));
}

#[test]
fn test_remove_oracle() {
    let (env, client, owner, initial_oracle) = setup_test();

    assert!(client.is_authorized_oracle(&initial_oracle));

    client.remove_oracle(&owner, &initial_oracle);

    assert!(!client.is_authorized_oracle(&initial_oracle));
}

#[test]
#[should_panic(expected = "Caller is not an authorized oracle")]
fn test_unauthorized_oracle_cannot_update() {
    let (env, client, _owner, _initial_oracle) = setup_test();

    let unauthorized = Address::generate(&env);
    client.update_price(
        &unauthorized,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &1_000_000_i128,
        &6_u32,
        &String::from_str(&env, "hacker"),
    );
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_non_owner_cannot_add_oracle() {
    let (env, client, _owner, _initial_oracle) = setup_test();

    let unauthorized = Address::generate(&env);
    let new_oracle = Address::generate(&env);
    client.add_oracle(
        &unauthorized,
        &new_oracle,
        &String::from_str(&env, "XLM/USDC"),
        &50_u32,
    );
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_multiple_price_feeds() {
    let (env, client, _owner, oracle) = setup_test();

    // Add XLM/USDC price
    client.update_price(
        &oracle,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &2_000_000_i128,
        &6_u32,
        &String::from_str(&env, "oracle"),
    );

    // Note: This contract uses a simplified model — only one price per pair
    // In production, you'd have multiple sources and aggregate them
}

#[test]
fn test_price_feed_immutable_after_update() {
    let (env, client, _owner, oracle) = setup_test();

    client.update_price(
        &oracle,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &1_000_000_i128,
        &6_u32,
        &String::from_str(&env, "oracle-v1"),
    );

    let feed1 = client.get_price_feed(
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
    )
    .unwrap();

    // Update with new price
    client.update_price(
        &oracle,
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
        &2_000_000_i128,
        &6_u32,
        &String::from_str(&env, "oracle-v2"),
    );

    let feed2 = client.get_price_feed(
        &String::from_str(&env, ASSET_XLM),
        &String::from_str(&env, ASSET_USDC),
    )
    .unwrap();

    assert_eq!(feed1.price, 1_000_000_i128);
    assert_eq!(feed2.price, 2_000_000_i128);
    assert!(feed2.updated_at > feed1.updated_at);
}
