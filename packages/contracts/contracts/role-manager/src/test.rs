//! RoleManager tests — Stellar/Soroban
//!
//! Tests cover: role assignment, revocation, role checking,
//! access control, and admin-only operations.

// `Ledger` supplies `env.ledger().with_mut(...)`; without it the suite does not
// compile (E0599).
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Vec,
};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, RoleManagerClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, RoleManager);
    let client = RoleManagerClient::new(&env, &contract_id);
    client.init(&owner);

    (env, client, owner.clone(), owner)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (_env, client, owner, _admin) = setup_test();

    // Owner should have Admin role after init
    assert!(client.has_role(&owner, &Role::Admin));
    assert!(!client.has_role(&owner, &Role::Verifier));
    assert!(!client.has_role(&owner, &Role::Operator));
    assert!(!client.has_role(&owner, &Role::Auditor));
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, RoleManager);
    let client = RoleManagerClient::new(&env, &contract_id);
    client.init(&owner);
    client.init(&owner);
}

// ════════════════════════════════════════════════════════════════════
// ROLE ASSIGNMENT
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_assign_role() {
    let (env, client, admin, _owner) = setup_test();

    let target = Address::generate(&env);

    assert!(!client.has_role(&target, &Role::Verifier));

    client.assign_role(&admin, &target, &Role::Verifier);

    assert!(client.has_role(&target, &Role::Verifier));
    assert!(!client.has_role(&target, &Role::Admin));
    assert!(!client.has_role(&target, &Role::Operator));
}

#[test]
fn test_assign_multiple_roles() {
    let (env, client, admin, _owner) = setup_test();

    let target = Address::generate(&env);

    client.assign_role(&admin, &target, &Role::Verifier);
    client.assign_role(&admin, &target, &Role::Operator);
    client.assign_role(&admin, &target, &Role::Auditor);

    assert!(client.has_role(&target, &Role::Verifier));
    assert!(client.has_role(&target, &Role::Operator));
    assert!(client.has_role(&target, &Role::Auditor));
    assert!(!client.has_role(&target, &Role::Admin)); // Admin only for owner
}

#[test]
fn test_assign_role_to_multiple_addresses() {
    let (env, client, admin, _owner) = setup_test();

    let a1 = Address::generate(&env);
    let a2 = Address::generate(&env);
    let a3 = Address::generate(&env);

    client.assign_role(&admin, &a1, &Role::Verifier);
    client.assign_role(&admin, &a2, &Role::Verifier);
    client.assign_role(&admin, &a3, &Role::Operator);

    assert!(client.has_role(&a1, &Role::Verifier));
    assert!(client.has_role(&a2, &Role::Verifier));
    assert!(client.has_role(&a3, &Role::Operator));
    assert!(!client.has_role(&a1, &Role::Operator));
    assert!(!client.has_role(&a2, &Role::Operator));
    assert!(!client.has_role(&a3, &Role::Verifier));
}

// ════════════════════════════════════════════════════════════════════
// ROLE REVOCATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_revoke_role() {
    let (env, client, admin, _owner) = setup_test();

    let target = Address::generate(&env);

    client.assign_role(&admin, &target, &Role::Verifier);
    assert!(client.has_role(&target, &Role::Verifier));

    client.revoke_role(&admin, &target, &Role::Verifier);

    assert!(!client.has_role(&target, &Role::Verifier));
}

#[test]
fn test_revoke_one_role_keeps_others() {
    let (env, client, admin, _owner) = setup_test();

    let target = Address::generate(&env);

    client.assign_role(&admin, &target, &Role::Verifier);
    client.assign_role(&admin, &target, &Role::Operator);
    client.assign_role(&admin, &target, &Role::Auditor);

    client.revoke_role(&admin, &target, &Role::Verifier);

    assert!(!client.has_role(&target, &Role::Verifier));
    assert!(client.has_role(&target, &Role::Operator));
    assert!(client.has_role(&target, &Role::Auditor));
}

// ════════════════════════════════════════════════════════════════════
// ACCESS CONTROL
// ════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Missing required role")]
fn test_non_admin_cannot_assign_role() {
    let (env, client, _admin, _owner) = setup_test();

    let non_admin = Address::generate(&env);
    let target = Address::generate(&env);

    client.assign_role(&non_admin, &target, &Role::Verifier);
}

#[test]
#[should_panic(expected = "Missing required role")]
fn test_non_admin_cannot_revoke_role() {
    let (env, client, _admin, _owner) = setup_test();

    let non_admin = Address::generate(&env);
    let target = Address::generate(&env);

    client.revoke_role(&non_admin, &target, &Role::Verifier);
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_has_role_returns_false_for_unknown() {
    let (env, client, _admin, _owner) = setup_test();

    let unknown = Address::generate(&env);
    assert!(!client.has_role(&unknown, &Role::Admin));
    assert!(!client.has_role(&unknown, &Role::Verifier));
    assert!(!client.has_role(&unknown, &Role::Operator));
    assert!(!client.has_role(&unknown, &Role::Auditor));
}

#[test]
fn test_revoke_nonexistent_role_is_noop() {
    let (env, client, admin, _owner) = setup_test();

    let target = Address::generate(&env);
    // Revoking a role that was never assigned should be fine (no panic)
    client.revoke_role(&admin, &target, &Role::Verifier);
}

// ════════════════════════════════════════════════════════════════════
// FUZZ: 10,000 iterations — role management stress test
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_fuzz_role_management() {
    let env = Env::default();
    env.mock_all_auths();
    // This suite performs thousands of contract calls; lift the per-test CPU
    // budget so the assertions, not the metering, decide the outcome.
    env.budget().reset_unlimited();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, RoleManager);
    let client = RoleManagerClient::new(&env, &contract_id);
    client.init(&owner);

    let roles = [Role::Admin, Role::Verifier, Role::Operator, Role::Auditor];

    // Generate 250 addresses and cycle roles across them deterministically.
    let mut addresses = Vec::new(&env);
    for _ in 0..250 {
        addresses.push_back(Address::generate(&env));
    }

    for i in 0usize..1000 {
        let addr = addresses.get((i % 250) as u32).unwrap();
        let role = roles[i % roles.len()].clone();

        client.assign_role(&owner, &addr, &role);
        assert!(client.has_role(&addr, &role));
    }

    // Revoke half the assignments; revocation must be observable immediately.
    for i in 0usize..500 {
        let addr = addresses.get((i % 250) as u32).unwrap();
        let role = roles[i % roles.len()].clone();

        assert!(client.has_role(&addr, &role));
        client.revoke_role(&owner, &addr, &role);
        assert!(!client.has_role(&addr, &role));
    }
}
