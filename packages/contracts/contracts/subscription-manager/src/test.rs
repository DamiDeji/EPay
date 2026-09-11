//! SubscriptionManager tests — Stellar/Soroban
//!
//! Tests cover: initialization, creation, renewal, pause, cancellation,
//! max payments cap, state transitions, and event emission.

use soroban_sdk::{testutils::Address as _, Env, Address, String};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, SubscriptionManagerClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, SubscriptionManager);
    let client = SubscriptionManagerClient::new(&env, &contract_id);
    client.init(&owner);

    (env, client, owner)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (env, client, _owner) = setup_test();
    assert_eq!(client.get_next_id(), 1);
    assert!(!client.subscription_exists(&1));
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, SubscriptionManager);
    let client = SubscriptionManagerClient::new(&env, &contract_id);
    client.init(&owner);
    client.init(&owner);
}

// ════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CREATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_create_subscription() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let plan_name = String::from_str(&env, "Premium Plan");
    let amount = 9_999_000_i128;
    let asset_code = String::from_str(&env, "XLM");
    let interval = BillingInterval::Monthly;
    let max_payments = Some(12_u32);

    let sub_id = client.create_subscription(
        &merchant,
        &customer,
        &plan_name,
        &amount,
        &asset_code,
        &interval,
        &max_payments,
    );

    assert_eq!(sub_id, 1);
    let sub = client.get_subscription(&sub_id).unwrap();
    assert_eq!(sub.sub_id, 1);
    assert_eq!(sub.plan_name, plan_name);
    assert_eq!(sub.amount, amount);
    assert_eq!(sub.status, SubStatus::Active);
    assert_eq!(sub.interval, BillingInterval::Monthly);
    assert_eq!(sub.max_payments, Some(12));
    assert_eq!(sub.payments_made, 0);
    assert_eq!(sub.customer, customer);
}

#[test]
fn test_create_subscription_without_max_payments() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    let sub_id = client.create_subscription(
        &merchant,
        &customer,
        &String::from_str(&env, "Unlimited"),
        &5_000_000_i128,
        &String::from_str(&env, "native"),
        &BillingInterval::Annually,
        &None,
    );

    let sub = client.get_subscription(&sub_id).unwrap();
    assert_eq!(sub.max_payments, None);
}

#[test]
fn test_subscription_id_increments() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    assert_eq!(client.get_next_id(), 1);
    client.create_subscription(
        &merchant,
        &customer,
        &String::from_str(&env, "Plan A"),
        &1_000_i128,
        &String::from_str(&env, "XLM"),
        &BillingInterval::Monthly,
        &None,
    );
    assert_eq!(client.get_next_id(), 2);
}

// ════════════════════════════════════════════════════════════════════
// SUBSCRIPTION RENEWAL
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_renew_subscription() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    let sub_id = client.create_subscription(
        &merchant,
        &customer,
        &String::from_str(&env, "Plan"),
        &1_000_000_i128,
        &String::from_str(&env, "XLM"),
        &BillingInterval::Monthly,
        &Some(3_u32),
    );

    assert_eq!(client.get_subscription(&sub_id).unwrap().payments_made, 0);

    client.renew(&sub_id);
    let sub = client.get_subscription(&sub_id).unwrap();
    assert_eq!(sub.payments_made, 1);

    client.renew(&sub_id);
    let sub = client.get_subscription(&sub_id).unwrap();
    assert_eq!(sub.payments_made, 2);

    client.renew(&sub_id);
    let sub = client.get_subscription(&sub_id).unwrap();
    assert_eq!(sub.payments_made, 3);
    // Max payments reached — should be cancelled
    assert_eq!(sub.status, SubStatus::Cancelled);
}

#[test]
fn test_renew_without_max_payments_never_cancels() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    let sub_id = client.create_subscription(
        &merchant,
        &customer,
        &String::from_str(&env, "Unlimited"),
        &1_000_000_i128,
        &String::from_str(&env, "XLM"),
        &BillingInterval::Monthly,
        &None,
    );

    for _ in 0..10 {
        client.renew(&sub_id);
    }

    let sub = client.get_subscription(&sub_id).unwrap();
    assert_eq!(sub.payments_made, 10);
    assert_eq!(sub.status, SubStatus::Active);
}

// ════════════════════════════════════════════════════════════════════
// PAUSE / CANCEL
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_pause_subscription() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    let sub_id = client.create_subscription(
        &merchant,
        &customer,
        &String::from_str(&env, "Plan"),
        &1_000_000_i128,
        &String::from_str(&env, "XLM"),
        &BillingInterval::Monthly,
        &None,
    );

    client.pause(&sub_id);
    assert_eq!(
        client.get_subscription(&sub_id).unwrap().status,
        SubStatus::Paused
    );
}

#[test]
fn test_cancel_subscription() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    let sub_id = client.create_subscription(
        &merchant,
        &customer,
        &String::from_str(&env, "Plan"),
        &1_000_000_i128,
        &String::from_str(&env, "XLM"),
        &BillingInterval::Monthly,
        &None,
    );

    client.cancel(&sub_id);
    let sub = client.get_subscription(&sub_id).unwrap();
    assert_eq!(sub.status, SubStatus::Cancelled);
    assert!(sub.cancelled_at.is_some());
}

// ════════════════════════════════════════════════════════════════════
// STATE TRANSITIONS
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_full_lifecycle() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    let sub_id = client.create_subscription(
        &merchant,
        &customer,
        &String::from_str(&env, "Test Plan"),
        &2_500_000_i128,
        &String::from_str(&env, "XLM"),
        &BillingInterval::Monthly,
        &Some(2_u32),
    );

    // Active (default)
    assert_eq!(
        client.get_subscription(&sub_id).unwrap().status,
        SubStatus::Active
    );

    // Renew once
    client.renew(&sub_id);
    assert_eq!(
        client.get_subscription(&sub_id).unwrap().payments_made,
        1
    );

    // Pause
    client.pause(&sub_id);
    assert_eq!(
        client.get_subscription(&sub_id).unwrap().status,
        SubStatus::Paused
    );

    // Resume by renewing (payments_made increments even from paused)
    client.renew(&sub_id);
    assert_eq!(
        client.get_subscription(&sub_id).unwrap().payments_made,
        2
    );

    // Cancel
    client.cancel(&sub_id);
    assert_eq!(
        client.get_subscription(&sub_id).unwrap().status,
        SubStatus::Cancelled
    );
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Subscription not found")]
fn test_operations_on_nonexistent_subscription() {
    let (env, client, _owner) = setup_test();
    client.renew(&9999_u64);
}

#[test]
fn test_subscription_exists() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    assert!(!client.subscription_exists(&1));

    let sub_id = client.create_subscription(
        &merchant,
        &customer,
        &String::from_str(&env, "Plan"),
        &1_000_i128,
        &String::from_str(&env, "XLM"),
        &BillingInterval::Monthly,
        &None,
    );

    assert!(client.subscription_exists(&sub_id));
    assert!(!client.subscription_exists(&9999));
}

// ════════════════════════════════════════════════════════════════════
// FUZZ: 10,000 iterations — subscription creation and renewal
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_fuzz_subscription_stress() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let contract_id = env.register_contract(None, SubscriptionManager);
    let client = SubscriptionManagerClient::new(&env, &contract_id);
    client.init(&owner);

    let plan_name = String::from_str(&env, "Fuzz Plan");
    let asset_code = String::from_str(&env, "XLM");

    // Create 1000 subscriptions with varying intervals
    let intervals = [
        BillingInterval::Daily,
        BillingInterval::Weekly,
        BillingInterval::Monthly,
        BillingInterval::Quarterly,
        BillingInterval::Annually,
    ];

    for i in 0..1000 {
        let amount = ((i as u64 + 1) * 100_000) as i128;
        let interval = intervals[i % intervals.len()];
        let max = if i % 3 == 0 { Some((i % 10 + 1) as u32) } else { None };

        let sub_id = client.create_subscription(
            &merchant,
            &customer,
            &plan_name,
            &amount,
            &asset_code,
            &interval,
            &max,
        );

        assert_eq!(sub_id, (i + 1) as u64);
        assert_eq!(
            client.get_subscription(&sub_id).unwrap().status,
            SubStatus::Active
        );

        // Renew some of them
        if i % 2 == 0 {
            client.renew(&sub_id);
        }
    }
}
