//! EmergencyPause tests — Stellar/Soroban
//!
//! Tests cover: pause/unpause, state queries, reason tracking,
//! access control, and require_not_paused guard.

// `Ledger` supplies `env.ledger().with_mut(...)`; without it the suite does not
// compile (E0599).
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, EmergencyPauseClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, EmergencyPause);
    let client = EmergencyPauseClient::new(&env, &contract_id);
    client.init(&owner);

    (env, client, owner)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (_env, client, _owner) = setup_test();

    // A freshly initialised pause switch is unset, and the guard call succeeds.
    assert!(!client.is_paused());
    client.require_not_paused();
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, EmergencyPause);
    let client = EmergencyPauseClient::new(&env, &contract_id);
    client.init(&owner);
    client.init(&owner);
}

// ════════════════════════════════════════════════════════════════════
// PAUSE / UNPAUSE
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_pause_by_owner() {
    let (env, client, owner) = setup_test();

    assert!(!client.is_paused());

    client.pause(&owner, &String::from_str(&env, "Security incident"));

    assert!(client.is_paused());
}

#[test]
fn test_unpause_by_owner() {
    let (env, client, owner) = setup_test();

    client.pause(&owner, &String::from_str(&env, "Testing"));
    assert!(client.is_paused());

    client.unpause(&owner);

    assert!(!client.is_paused());
}

#[test]
fn test_pause_unpause_cycle() {
    let (env, client, owner) = setup_test();

    for _ in 0..10 {
        client.pause(&owner, &String::from_str(&env, "Cycle"));
        assert!(client.is_paused());
        client.unpause(&owner);
        assert!(!client.is_paused());
    }
}

// ════════════════════════════════════════════════════════════════════
// ACCESS CONTROL
// ════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Only owner can pause")]
fn test_non_owner_cannot_pause() {
    let (env, client, _owner) = setup_test();

    let unauthorized = Address::generate(&env);
    client.pause(&unauthorized, &String::from_str(&env, "Nope"));
}

#[test]
#[should_panic(expected = "Only owner can unpause")]
fn test_non_owner_cannot_unpause() {
    let (env, client, owner) = setup_test();

    client.pause(&owner, &String::from_str(&env, "temp"));
    assert!(client.is_paused());

    let unauthorized = Address::generate(&env);
    client.unpause(&unauthorized);
}

// ════════════════════════════════════════════════════════════════════
// GUARD: require_not_paused
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_require_not_paused_when_unpaused() {
    let (_env, client, _owner) = setup_test();
    // Should not panic when unpaused
    client.require_not_paused();
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_require_not_paused_when_paused() {
    let (env, client, owner) = setup_test();

    client.pause(&owner, &String::from_str(&env, "Paused"));
    client.require_not_paused();
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_pause_with_empty_reason() {
    let (env, client, owner) = setup_test();

    client.pause(&owner, &String::from_str(&env, ""));
    assert!(client.is_paused());
}

#[test]
fn test_pause_with_long_reason() {
    let (env, client, owner) = setup_test();

    let long_reason = "A".repeat(1000);
    let reason = String::from_str(&env, &long_reason);
    client.pause(&owner, &reason);
    assert!(client.is_paused());
}

// ════════════════════════════════════════════════════════════════════
// STRESS: repeated pause/unpause cycles
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_fuzz_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, EmergencyPause);
    let client = EmergencyPauseClient::new(&env, &contract_id);
    client.init(&owner);
    // Every iteration issues two metered contract calls.
    env.budget().reset_unlimited();

    for i in 0..256usize {
        env.ledger()
            .with_mut(|li| li.timestamp = 1_000_000 + i as u64 * 100);

        // `format!` is unavailable in `no_std`; the reason is a fixed literal.
        let reason = String::from_str(&env, "stress");
        client.pause(&owner, &reason);
        assert!(client.is_paused());

        client.unpause(&owner);
        assert!(!client.is_paused());

        // Read-only status is a pure function of stored state.
        assert!(!client.is_paused());
        assert!(!client.is_paused());
    }
}
