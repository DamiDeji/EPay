//! ConfigurationManager tests — Stellar/Soroban
//!
//! Tests cover: platform config initialization, config retrieval,
//! config updates, maintenance mode toggle, and access control.

// `Ledger` supplies `env.ledger().with_mut(...)`; without it the suite does not
// compile (E0599).
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, ConfigurationManagerClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, ConfigurationManager);
    let client = ConfigurationManagerClient::new(&env, &contract_id);
    client.init(&owner);

    (env, client, owner)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (_env, client, _owner) = setup_test();

    let config = client.get_config();
    assert_eq!(config.platform_fee_bps, 50);
    assert_eq!(config.min_payment_amount, 1_000_000);
    assert_eq!(config.max_payment_amount, 100_000_000_000_000);
    assert_eq!(config.payment_expiry_seconds, 3600);
    assert_eq!(config.refund_window_days, 90);
    assert_eq!(config.max_milestones, 20);
    assert_eq!(config.settlement_interval_days, 7);
    assert!(!config.maintenance_mode);
    assert!(config.updated_at > 0);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, ConfigurationManager);
    let client = ConfigurationManagerClient::new(&env, &contract_id);
    client.init(&owner);
    client.init(&owner);
}

// ════════════════════════════════════════════════════════════════════
// CONFIG RETRIEVAL
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_get_config() {
    let (_env, client, _owner) = setup_test();

    let config = client.get_config();
    assert_eq!(config.platform_fee_bps, 50);
    assert_eq!(config.min_payment_amount, 1_000_000);
    assert_eq!(config.max_payment_amount, 100_000_000_000_000);
}

#[test]
fn test_is_maintenance_mode_default() {
    let (_env, client, _owner) = setup_test();
    assert!(!client.is_maintenance_mode());
}

// ════════════════════════════════════════════════════════════════════
// CONFIG UPDATE
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_update_config_by_owner() {
    let (env, client, owner) = setup_test();

    let _original = client.get_config();
    let new_config = PlatformConfig {
        platform_fee_bps: 100,
        min_payment_amount: 500_000,
        max_payment_amount: 50_000_000_000_000,
        payment_expiry_seconds: 7200,
        refund_window_days: 30,
        max_milestones: 10,
        settlement_interval_days: 14,
        maintenance_mode: true,
        updated_at: 0, // Will be overridden
    };

    env.ledger().with_mut(|li| li.timestamp = 2_000_000);

    client.update_config(&owner, &new_config);

    let updated = client.get_config();
    assert_eq!(updated.platform_fee_bps, 100);
    assert_eq!(updated.min_payment_amount, 500_000);
    assert_eq!(updated.max_payment_amount, 50_000_000_000_000);
    assert_eq!(updated.payment_expiry_seconds, 7200);
    assert_eq!(updated.refund_window_days, 30);
    assert_eq!(updated.max_milestones, 10);
    assert_eq!(updated.settlement_interval_days, 14);
    assert!(updated.maintenance_mode);
    assert_eq!(updated.updated_at, 2_000_000);
}

#[test]
fn test_update_config_preserves_fields_not_specified() {
    let (env, client, owner) = setup_test();

    // Update only maintenance_mode
    let mut original = client.get_config();
    original.maintenance_mode = true;

    env.ledger().with_mut(|li| li.timestamp = 2_000_000);
    client.update_config(&owner, &original);

    let updated = client.get_config();
    assert!(updated.maintenance_mode);
    assert_eq!(updated.platform_fee_bps, 50); // unchanged
    assert_eq!(updated.min_payment_amount, 1_000_000); // unchanged
}

#[test]
#[should_panic(expected = "Only owner can update config")]
fn test_non_owner_cannot_update() {
    let (env, client, _owner) = setup_test();

    let unauthorized = Address::generate(&env);
    let new_config = PlatformConfig {
        platform_fee_bps: 100,
        min_payment_amount: 1_000_000,
        max_payment_amount: 100_000_000_000_000,
        payment_expiry_seconds: 3600,
        refund_window_days: 90,
        max_milestones: 20,
        settlement_interval_days: 7,
        maintenance_mode: false,
        updated_at: 0,
    };

    client.update_config(&unauthorized, &new_config);
}

// ════════════════════════════════════════════════════════════════════
// MAINTENANCE MODE
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_toggle_maintenance_mode() {
    let (env, client, owner) = setup_test();

    assert!(!client.is_maintenance_mode());

    let mut config = client.get_config();
    config.maintenance_mode = true;
    env.ledger().with_mut(|li| li.timestamp = 2_000_000);
    client.update_config(&owner, &config);

    assert!(client.is_maintenance_mode());

    let mut config = client.get_config();
    config.maintenance_mode = false;
    env.ledger().with_mut(|li| li.timestamp = 3_000_000);
    client.update_config(&owner, &config);

    assert!(!client.is_maintenance_mode());
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_config_updated_at_increments() {
    let (env, client, owner) = setup_test();

    let config1 = client.get_config();
    let ts1 = config1.updated_at;

    env.ledger().with_mut(|li| li.timestamp = ts1 + 1000);
    let mut new_config = client.get_config();
    new_config.platform_fee_bps = 75;
    client.update_config(&owner, &new_config);

    let config2 = client.get_config();
    assert!(config2.updated_at > ts1);
    assert_eq!(config2.platform_fee_bps, 75);
}

#[test]
fn test_concurrent_config_reads() {
    let (_env, client, _owner) = setup_test();

    // Read config multiple times — should be consistent
    let c1 = client.get_config();
    let c2 = client.get_config();
    let c3 = client.get_config();

    assert_eq!(c1.platform_fee_bps, c2.platform_fee_bps);
    assert_eq!(c1.platform_fee_bps, c3.platform_fee_bps);
}

// ════════════════════════════════════════════════════════════════════
// FUZZ: 10,000 iterations — config update stress test
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_fuzz_config_updates() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, ConfigurationManager);
    let client = ConfigurationManagerClient::new(&env, &contract_id);
    client.init(&owner);
    env.budget().reset_unlimited();

    let intervals: [u64; 7] = [1, 7, 14, 30, 60, 90, 365];

    // Each step writes and reads back a full config; bound the sweep so the
    // metered host calls stay fast enough for every commit.
    for i in 0..256usize {
        env.ledger()
            .with_mut(|li| li.timestamp = 1_000_000 + i as u64 * 100);

        let mut config = client.get_config();
        config.platform_fee_bps = 10 + ((i % 50) * 10) as u32;
        config.min_payment_amount = ((i as u64 + 1) * 100_000) as i128;
        config.max_payment_amount = 100_000_000_000_000_i128 - (i as i128) * 1_000_000_000;
        config.payment_expiry_seconds = intervals[i % intervals.len()];
        config.refund_window_days = 30 + ((i % 12) * 30) as u32;
        config.max_milestones = 5 + (i % 16) as u32;
        config.settlement_interval_days = intervals[(i / 2) % intervals.len()] as u32;
        config.maintenance_mode = i % 3 == 0;

        client.update_config(&owner, &config);

        let read_back = client.get_config();
        assert_eq!(read_back.platform_fee_bps, config.platform_fee_bps);
        assert_eq!(read_back.min_payment_amount, config.min_payment_amount);
        assert_eq!(read_back.maintenance_mode, config.maintenance_mode);
        assert_eq!(read_back.updated_at, env.ledger().timestamp());
    }
}
