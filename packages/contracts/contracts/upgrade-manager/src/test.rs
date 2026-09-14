//! UpgradeManager tests — Stellar/Soroban
//!
//! Tests cover: two-step admin transfer, timelocked upgrades,
//! upgrade cancellation, access control, and edge cases.

// `Ledger` supplies `env.ledger().with_mut(...)`; without it the suite does not
// compile (E0599).
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Bytes, Env, String,
};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, UpgradeManagerClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, UpgradeManager);
    let client = UpgradeManagerClient::new(&env, &contract_id);
    client.init(&owner);

    (env, client, owner)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (_env, client, owner) = setup_test();

    assert_eq!(client.get_admin(), owner);
    assert!(!client.has_pending_admin_transfer());
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, UpgradeManager);
    let client = UpgradeManagerClient::new(&env, &contract_id);
    client.init(&owner);
    client.init(&owner);
}

// ════════════════════════════════════════════════════════════════════
// ADMIN TRANSFER — TWO-STEP
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_transfer_admin_proposes() {
    let (env, client, owner) = setup_test();

    assert!(!client.has_pending_admin_transfer());

    let new_admin = Address::generate(&env);
    client.transfer_admin(&owner, &new_admin);

    assert!(client.has_pending_admin_transfer());
    assert_eq!(client.get_pending_admin(), Some(new_admin));
}

#[test]
fn test_accept_admin_transfer() {
    let (env, client, owner) = setup_test();

    let new_admin = Address::generate(&env);
    client.transfer_admin(&owner, &new_admin);

    // Accept as the new admin
    client.accept_admin(&new_admin);

    assert_eq!(client.get_admin(), new_admin);
    assert!(!client.has_pending_admin_transfer());
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
#[should_panic(expected = "Only the proposed admin can accept")]
fn test_non_proposed_admin_cannot_accept() {
    let (env, client, owner) = setup_test();

    let new_admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    client.transfer_admin(&owner, &new_admin);
    client.accept_admin(&unauthorized);
}

#[test]
#[should_panic(expected = "No admin transfer pending")]
fn test_accept_without_transfer() {
    let (env, client, _owner) = setup_test();
    let random = Address::generate(&env);
    client.accept_admin(&random);
}

#[test]
fn test_cancel_admin_transfer() {
    let (env, client, owner) = setup_test();

    let new_admin = Address::generate(&env);
    client.transfer_admin(&owner, &new_admin);
    assert!(client.has_pending_admin_transfer());

    client.cancel_admin_transfer(&owner);
    assert!(!client.has_pending_admin_transfer());
}

#[test]
#[should_panic(expected = "Only admin can perform this action")]
fn test_non_admin_cannot_transfer() {
    let (env, client, _owner) = setup_test();

    let unauthorized = Address::generate(&env);
    let new_admin = Address::generate(&env);
    client.transfer_admin(&unauthorized, &new_admin);
}

#[test]
#[should_panic(expected = "Cannot transfer admin to the current admin")]
fn test_cannot_transfer_to_current_admin() {
    let (_env, client, owner) = setup_test();

    // Handing the admin role to the current admin would make the two-step
    // handover a no-op and silently clear any genuine pending transfer.
    client.transfer_admin(&owner, &owner);
}

// ════════════════════════════════════════════════════════════════════
// TIMELOCKED UPGRADES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_propose_upgrade() {
    let (env, client, owner) = setup_test();

    let wasm_hash = Bytes::from_slice(&env, &[1u8; 32]); // 32-byte SHA-256 hash
    let description = String::from_str(&env, "Security patch");

    let proposal_id = client.propose_upgrade(&owner, &wasm_hash, &description);

    assert_eq!(proposal_id, 1);
    let proposal = client.get_upgrade_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.new_wasm_hash, wasm_hash);
    assert_eq!(proposal.description, description);
    assert!(proposal.executable_at > proposal.proposed_at);
}

#[test]
#[should_panic(expected = "WASM hash must be 32 bytes (SHA-256)")]
fn test_propose_upgrade_invalid_hash() {
    let (env, client, owner) = setup_test();

    let short_hash = Bytes::from_slice(&env, &[1u8; 16]); // Too short
    client.propose_upgrade(&owner, &short_hash, &String::from_str(&env, "Bad hash"));
}

#[test]
fn test_execute_upgrade_after_timelock() {
    let (env, client, owner) = setup_test();

    let wasm_hash = Bytes::from_slice(&env, &[1u8; 32]);
    let proposal_id =
        client.propose_upgrade(&owner, &wasm_hash, &String::from_str(&env, "Upgrade"));

    let proposal = client.get_upgrade_proposal(&proposal_id).unwrap();
    let executable_at = proposal.executable_at;

    // Fast-forward past the timelock
    env.ledger().with_mut(|li| li.timestamp = executable_at + 1);

    client.execute_upgrade(&owner, &proposal_id);

    assert_eq!(
        client.get_upgrade_proposal(&proposal_id),
        None,
        "Proposal should be removed after execution"
    );
}

#[test]
#[should_panic(expected = "Upgrade timelock has not expired")]
fn test_execute_upgrade_before_timelock() {
    let (env, client, owner) = setup_test();

    let wasm_hash = Bytes::from_slice(&env, &[1u8; 32]);
    let proposal_id =
        client.propose_upgrade(&owner, &wasm_hash, &String::from_str(&env, "Upgrade"));

    // Try to execute immediately (before timelock)
    client.execute_upgrade(&owner, &proposal_id);
}

#[test]
#[should_panic(expected = "Upgrade proposal not found")]
fn test_execute_nonexistent_upgrade() {
    let (env, client, owner) = setup_test();

    env.ledger().with_mut(|li| li.timestamp = 999_999_999_999);
    client.execute_upgrade(&owner, &9999_u64);
}

#[test]
fn test_cancel_upgrade() {
    let (env, client, owner) = setup_test();

    let wasm_hash = Bytes::from_slice(&env, &[1u8; 32]);
    let proposal_id =
        client.propose_upgrade(&owner, &wasm_hash, &String::from_str(&env, "Will cancel"));

    assert!(client.get_upgrade_proposal(&proposal_id).is_some());

    client.cancel_upgrade(&owner, &proposal_id);

    assert_eq!(
        client.get_upgrade_proposal(&proposal_id),
        None,
        "Proposal should be removed after cancellation"
    );
}

#[test]
#[should_panic(expected = "Only admin can perform this action")]
fn test_non_admin_cannot_propose_upgrade() {
    let (env, client, _owner) = setup_test();

    let unauthorized = Address::generate(&env);
    client.propose_upgrade(
        &unauthorized,
        &Bytes::from_slice(&env, &[1u8; 32]),
        &String::from_str(&env, "Hack"),
    );
}

// ════════════════════════════════════════════════════════════════════
// ADMIN AUTHORITY CHECKS
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_is_admin() {
    let (env, client, owner) = setup_test();

    assert!(client.is_admin(&owner));
    assert!(!client.is_admin(&Address::generate(&env)));
}

// ════════════════════════════════════════════════════════════════════
// FULL WORKFLOW
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_full_admin_transfer_workflow() {
    let (env, client, owner) = setup_test();

    let new_admin = Address::generate(&env);

    // Step 1: Propose transfer
    client.transfer_admin(&owner, &new_admin);
    assert!(client.has_pending_admin_transfer());

    // Step 2: Accept transfer
    client.accept_admin(&new_admin);
    assert_eq!(client.get_admin(), new_admin);

    // New admin can now propose upgrades
    let wasm_hash = Bytes::from_slice(&env, &[2u8; 32]);
    let proposal_id = client.propose_upgrade(
        &new_admin,
        &wasm_hash,
        &String::from_str(&env, "New feature"),
    );

    assert_eq!(proposal_id, 1);
}

#[test]
fn test_upgrade_proposal_chain() {
    let (env, client, owner) = setup_test();

    for i in 0..5 {
        let wasm_hash = Bytes::from_slice(&env, &[i as u8; 32]);
        let desc = String::from_str(&env, "Upgrade");
        let id = client.propose_upgrade(&owner, &wasm_hash, &desc);
        assert_eq!(id, (i + 1) as u64);
    }

    // Verify all proposals exist
    for i in 1..=5 {
        assert!(client.get_upgrade_proposal(&i).is_some());
    }

    // Execute the first one (after timelock)
    env.ledger().with_mut(|li| li.timestamp = 999_999_999_999);
    client.execute_upgrade(&owner, &1_u64);

    // First is gone, others remain
    assert_eq!(client.get_upgrade_proposal(&1), None);
    for i in 2..=5 {
        assert!(client.get_upgrade_proposal(&i).is_some());
    }
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_transfer_then_cancel_then_transfer_again() {
    let (env, client, owner) = setup_test();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);

    // First transfer
    client.transfer_admin(&owner, &admin1);
    assert!(client.has_pending_admin_transfer());

    // Cancel
    client.cancel_admin_transfer(&owner);
    assert!(!client.has_pending_admin_transfer());

    // Second transfer
    client.transfer_admin(&owner, &admin2);
    assert!(client.has_pending_admin_transfer());
    assert_eq!(client.get_pending_admin(), Some(admin2));
}

#[test]
fn test_multiple_admin_transfers_only_one_pending() {
    let (env, client, owner) = setup_test();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);

    client.transfer_admin(&owner, &admin1);
    client.transfer_admin(&owner, &admin2); // Overwrites

    assert_eq!(client.get_pending_admin(), Some(admin2));
}
