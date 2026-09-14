//! MerchantRegistry tests — Stellar/Soroban
//!
//! Tests cover: merchant registration, verification, suspension, reactivation,
//! address lookups, verification level bumps, and authorization checks.

// `Ledger` supplies `env.ledger().with_mut(...)`; without it the suite does not
// compile (E0599).
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String, Vec,
};

use super::*;

/// Set up the test environment with an owner (who is also the verifier).
fn setup_test() -> (Env, MerchantRegistryClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, MerchantRegistry);
    let client = MerchantRegistryClient::new(&env, &contract_id);
    client.init(&owner);

    (env, client, owner.clone(), owner)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (env, client, owner, _verifier) = setup_test();

    // An empty registry knows nobody, and the first merchant gets id 1.
    assert!(!client.is_merchant(&Address::generate(&env)));

    let id = client.register_merchant(
        &owner,
        &String::from_str(&env, "Acme"),
        &String::from_str(&env, "billing@acme.test"),
        &Address::generate(&env),
        &None,
        &None,
    );
    assert_eq!(id, 1);
    assert!(client.is_merchant(&owner));
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, MerchantRegistry);
    let client = MerchantRegistryClient::new(&env, &contract_id);
    client.init(&owner);
    client.init(&owner);
}

// ════════════════════════════════════════════════════════════════════
// MERCHANT REGISTRATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_register_merchant() {
    let (env, client, owner, _verifier) = setup_test();

    let business_name = String::from_str(&env, "Acme Corp");
    let business_email = String::from_str(&env, "admin@acme.test");
    let settlement_address = Address::generate(&env);
    let business_url = String::from_str(&env, "https://acme.test");
    let webhook_url = String::from_str(&env, "https://acme.test/hooks");

    let merchant_id = client.register_merchant(
        &owner,
        &business_name,
        &business_email,
        &settlement_address,
        &Some(business_url.clone()),
        &Some(webhook_url.clone()),
    );

    assert_eq!(merchant_id, 1);
    let merchant = client.get_merchant(&merchant_id).unwrap();
    assert_eq!(merchant.business_name, business_name);
    assert_eq!(merchant.business_email, business_email);
    assert_eq!(merchant.settlement_address, settlement_address);
    assert_eq!(merchant.business_url, Some(business_url));
    assert_eq!(merchant.webhook_url, Some(webhook_url));
    assert_eq!(merchant.status, MerchantStatus::Pending);
    assert_eq!(merchant.verification_level, VerificationLevel::None);
    assert!(!merchant.is_active);
    assert_eq!(merchant.fee_bps, 50);
}

#[test]
fn test_register_merchant_without_optional_fields() {
    let (env, client, owner, _verifier) = setup_test();

    let merchant_id = client.register_merchant(
        &owner,
        &String::from_str(&env, "Minimal Corp"),
        &String::from_str(&env, "minimal@test"),
        &Address::generate(&env),
        &None,
        &None,
    );

    let merchant = client.get_merchant(&merchant_id).unwrap();
    assert_eq!(merchant.business_url, None);
    assert_eq!(merchant.webhook_url, None);
}

#[test]
#[should_panic(expected = "Address already registered")]
fn test_cannot_register_twice() {
    let (env, client, owner, _verifier) = setup_test();

    let settlement = Address::generate(&env);
    client.register_merchant(
        &owner,
        &String::from_str(&env, "First"),
        &String::from_str(&env, "first@test"),
        &settlement,
        &None,
        &None,
    );
    client.register_merchant(
        &owner,
        &String::from_str(&env, "Second"),
        &String::from_str(&env, "second@test"),
        &settlement,
        &None,
        &None,
    );
}

// ════════════════════════════════════════════════════════════════════
// MERCHANT VERIFICATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_verify_merchant() {
    let (env, client, owner, verifier) = setup_test();

    let settlement = Address::generate(&env);
    let merchant_id = client.register_merchant(
        &owner,
        &String::from_str(&env, "New Merchant"),
        &String::from_str(&env, "new@test"),
        &settlement,
        &None,
        &None,
    );

    assert_eq!(
        client.get_merchant(&merchant_id).unwrap().status,
        MerchantStatus::Pending
    );

    client.verify_merchant(&verifier, &merchant_id);

    let merchant = client.get_merchant(&merchant_id).unwrap();
    assert_eq!(merchant.status, MerchantStatus::Active);
    assert_eq!(merchant.verification_level, VerificationLevel::Verified);
    assert!(merchant.is_active);
}

#[test]
#[should_panic(expected = "Merchant not pending")]
fn test_cannot_verify_non_pending() {
    let (env, client, owner, verifier) = setup_test();

    let settlement = Address::generate(&env);
    let merchant_id = client.register_merchant(
        &owner,
        &String::from_str(&env, "Merchant"),
        &String::from_str(&env, "m@test"),
        &settlement,
        &None,
        &None,
    );

    // First verify
    client.verify_merchant(&verifier, &merchant_id);

    // Try to verify again
    client.verify_merchant(&verifier, &merchant_id);
}

#[test]
#[should_panic(expected = "Not authorized")]
fn test_unauthorized_verification() {
    let (env, client, owner, _verifier) = setup_test();

    let settlement = Address::generate(&env);
    let merchant_id = client.register_merchant(
        &owner,
        &String::from_str(&env, "Merchant"),
        &String::from_str(&env, "m@test"),
        &settlement,
        &None,
        &None,
    );

    let unauthorized = Address::generate(&env);
    client.verify_merchant(&unauthorized, &merchant_id);
}

// ════════════════════════════════════════════════════════════════════
// SUSPEND / REACTIVATE
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_suspend_and_reactivate() {
    let (env, client, owner, verifier) = setup_test();

    let settlement = Address::generate(&env);
    let merchant_id = client.register_merchant(
        &owner,
        &String::from_str(&env, "Merchant"),
        &String::from_str(&env, "m@test"),
        &settlement,
        &None,
        &None,
    );

    // Must be verified first
    client.verify_merchant(&verifier, &merchant_id);
    assert_eq!(
        client.get_merchant(&merchant_id).unwrap().status,
        MerchantStatus::Active
    );

    // Suspend
    client.suspend_merchant(&verifier, &merchant_id);
    let merchant = client.get_merchant(&merchant_id).unwrap();
    assert_eq!(merchant.status, MerchantStatus::Suspended);
    assert!(!merchant.is_active);

    // Reactivate
    client.reactivate_merchant(&verifier, &merchant_id);
    let merchant = client.get_merchant(&merchant_id).unwrap();
    assert_eq!(merchant.status, MerchantStatus::Active);
    assert!(merchant.is_active);
}

#[test]
#[should_panic(expected = "Can only suspend active")]
fn test_cannot_suspend_non_active() {
    let (env, client, owner, verifier) = setup_test();

    let settlement = Address::generate(&env);
    let merchant_id = client.register_merchant(
        &owner,
        &String::from_str(&env, "Merchant"),
        &String::from_str(&env, "m@test"),
        &settlement,
        &None,
        &None,
    );

    // Try to suspend a pending merchant
    client.suspend_merchant(&verifier, &merchant_id);
}

#[test]
#[should_panic(expected = "Not suspended")]
fn test_cannot_reactivate_non_suspended() {
    let (env, client, owner, verifier) = setup_test();

    let settlement = Address::generate(&env);
    let merchant_id = client.register_merchant(
        &owner,
        &String::from_str(&env, "Merchant"),
        &String::from_str(&env, "m@test"),
        &settlement,
        &None,
        &None,
    );

    // Try to reactivate a pending merchant
    client.reactivate_merchant(&verifier, &merchant_id);
}

// ════════════════════════════════════════════════════════════════════
// ADDRESS LOOKUP
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_get_merchant_by_address() {
    let (env, client, owner, _verifier) = setup_test();

    let settlement = Address::generate(&env);
    let merchant_id = client.register_merchant(
        &owner,
        &String::from_str(&env, "Address Test"),
        &String::from_str(&env, "addr@test"),
        &settlement,
        &None,
        &None,
    );

    let merchant = client.get_merchant_by_address(&owner).unwrap();
    assert_eq!(merchant.merchant_id, merchant_id);
    assert!(!client.is_merchant(&Address::generate(&env)));
}

#[test]
fn test_is_merchant_active() {
    let (env, client, owner, verifier) = setup_test();

    let settlement = Address::generate(&env);
    client.register_merchant(
        &owner,
        &String::from_str(&env, "Merchant"),
        &String::from_str(&env, "m@test"),
        &settlement,
        &None,
        &None,
    );

    assert!(!client.is_merchant_active(&owner));

    client.verify_merchant(&verifier, &1_u64);
    assert!(client.is_merchant_active(&owner));

    client.suspend_merchant(&verifier, &1_u64);
    assert!(!client.is_merchant_active(&owner));
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_get_nonexistent_merchant() {
    let (_env, client, _owner, _verifier) = setup_test();

    // Unknown ids are reported as absent rather than panicking, so callers can
    // distinguish "not registered" from a failed call.
    assert!(client.get_merchant(&9999_u64).is_none());
}

#[test]
fn test_multiple_merchants_independent() {
    let (env, client, _owner, verifier) = setup_test();

    // One merchant per owner address: `merchant` is the account being
    // registered, `m1..m3` are the settlement destinations.
    let merchant = Address::generate(&env);
    let m1 = Address::generate(&env);
    let m2 = Address::generate(&env);
    let m3 = Address::generate(&env);

    let id1 = client.register_merchant(
        &merchant,
        &String::from_str(&env, "Merchant 1"),
        &String::from_str(&env, "m1@test"),
        &m1,
        &None,
        &None,
    );
    let id2 = client.register_merchant(
        &Address::generate(&env),
        &String::from_str(&env, "Merchant 2"),
        &String::from_str(&env, "m2@test"),
        &m2,
        &None,
        &None,
    );
    let id3 = client.register_merchant(
        &Address::generate(&env),
        &String::from_str(&env, "Merchant 3"),
        &String::from_str(&env, "m3@test"),
        &m3,
        &None,
        &None,
    );

    // Ids are allocated in registration order and are distinct.
    assert_eq!((id1, id2, id3), (1, 2, 3));

    // Verify only the first
    client.verify_merchant(&verifier, &id1);

    assert_eq!(
        client.get_merchant(&id1).unwrap().status,
        MerchantStatus::Active
    );
    assert_eq!(
        client.get_merchant(&id2).unwrap().status,
        MerchantStatus::Pending
    );
    assert_eq!(
        client.get_merchant(&id3).unwrap().status,
        MerchantStatus::Pending
    );
}

// ════════════════════════════════════════════════════════════════════
// END-TO-END SWEEP: registration, verification, suspension, reactivation
// ════════════════════════════════════════════════════════════════════

/// Number of merchants registered by the registry sweep. Each registration is a
/// metered host call, so this is sized for CI runtime.
const COUNT: u64 = 128;

#[test]
fn test_fuzz_merchant_registry() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, MerchantRegistry);
    let client = MerchantRegistryClient::new(&env, &contract_id);
    client.init(&owner);
    // Each iteration issues several metered contract calls; the assertions, not
    // the per-test CPU budget, should decide the outcome.
    env.budget().reset_unlimited();

    // Register `COUNT` merchants. `format!` is unavailable in `no_std`, so the
    // fixture data is drawn from fixed literals.
    let mut merchants = Vec::new(&env);
    for i in 0..COUNT {
        let owner_addr = Address::generate(&env);
        let settlement = Address::generate(&env);
        let id = client.register_merchant(
            &owner_addr,
            &String::from_str(&env, "Example Merchant"),
            &String::from_str(&env, "billing@example.test"),
            &settlement,
            &None,
            &None,
        );

        // IDs are allocated sequentially from 1, with no gaps or reuse.
        assert_eq!(id, i + 1);

        merchants.push_back((id, owner_addr, settlement));
    }

    // Verify half of them
    for i in 0..COUNT as usize {
        if i % 2 == 0 {
            let (id, _, _) = merchants.get(i as u32).unwrap();
            client.verify_merchant(&owner, &id);
            assert_eq!(
                client.get_merchant(&id).unwrap().status,
                MerchantStatus::Active
            );
        }
    }

    // Suspend some verified ones
    for i in 0..COUNT as usize {
        if i % 2 == 0 && i % 5 == 0 {
            let (id, _, _) = merchants.get(i as u32).unwrap();
            client.suspend_merchant(&owner, &id);
            assert_eq!(
                client.get_merchant(&id).unwrap().status,
                MerchantStatus::Suspended
            );
        }
    }

    // Reactivate some suspended
    for i in 0..COUNT as usize {
        if i % 2 == 0 && i % 5 == 0 && i % 7 == 0 {
            let (id, _, _) = merchants.get(i as u32).unwrap();
            client.reactivate_merchant(&owner, &id);
            assert_eq!(
                client.get_merchant(&id).unwrap().status,
                MerchantStatus::Active
            );
        }
    }

    // Every registered merchant is still addressable by its id afterwards.
    for i in 0..COUNT as usize {
        let (id, _, _) = merchants.get(i as u32).unwrap();
        assert!(client.get_merchant(&id).is_some());
    }
}
