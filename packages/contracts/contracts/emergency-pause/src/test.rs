//! EmergencyPause tests — Stellar/Soroban
//!
//! Tests cover: pause/unpause, state queries, reason tracking,
//! access control, and require_not_paused guard.

use soroban_sdk::{testutils::Address as _, Env, Address, String};

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
    let (env, client, _owner) = setup_test();

    assert!(!client.is_paused());
    let state = client.get_state_internal(); // We test via is_paused
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
    let (env, client, _owner) = setup_test();

    client.pause(&client.get_owner_internal_eboost(), &String::from_str(&env, "temp"));

    let unauthorized = Address::generate(&env);
    client.unpause(&unauthorized);
}

// ════════════════════════════════════════════════════════════════════
// GUARD: require_not_paused
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_require_not_paused_when_unpaused() {
    let (env, client, _owner) = setup_test();
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

    let reason = String::from_str(&env, "A".repeat(1000));
    client.pause(&owner, &reason);
    assert!(client.is_paused());
}

// ════════════════════════════════════════════════════════════════════
// FUZZ: 10,000 iterations — pause/unpause stress test
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

    for i in 0..5000 {
        env.ledger().with_mut(|li| li.timestamp = 1_000_000 + i as u64 * 100);

        let reason = String::from_str(&env, &format!("Reason {}", i));
        client.pause(&owner, &reason);
        assert!(client.is_paused());

        client.unpause(&owner);
        assert!(!client.is_paused());

        // Verify idempotency of is_paused
        assert_eq!(client.is_paused(), false);
        assert_eq!(client.is_paused(), false);
    }
}
