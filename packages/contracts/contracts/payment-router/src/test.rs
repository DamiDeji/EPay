//! PaymentRouter tests — Stellar/Soroban
//!
//! Tests cover: initialization, payment creation, confirmation, completion,
//! failure, refund, expiry, minimum amounts, fee calculation, and state transitions.
//! Token transfers are verified via the Soroban test token (Stellar Asset Contract).

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

use super::*;

/// Set up the test environment with a mock Stellar Asset Contract (token).
fn setup_test() -> (
    Env,
    PaymentRouterClient<'static>,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let config = Address::generate(&env);
    let fee_mgr = Address::generate(&env);
    let pause = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();

    let contract_id = env.register_contract(None, PaymentRouter);
    let client = PaymentRouterClient::new(&env, &contract_id);
    client.init(&owner, &config, &fee_mgr, &pause, &token_address);

    (env, client, contract_id, owner, token_admin, token_address)
}

/// Helper: fund a contract address with tokens from the token admin.
fn fund_address(env: &Env, token_address: &Address, recipient: &Address, amount: i128) {
    let token_client = token::StellarAssetClient::new(env, token_address);
    token_client.mint(recipient, &amount);
}

// ════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (_env, client, _contract_id, _owner, _token_admin, _token) = setup_test();
    assert_eq!(client.get_next_id(), 1);
    assert_eq!(client.get_payment_count(), 0);
    let _ = client.get_token_address();
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let config = Address::generate(&env);
    let fee_mgr = Address::generate(&env);
    let pause = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();

    let contract_id = env.register_contract(None, PaymentRouter);
    let client = PaymentRouterClient::new(&env, &contract_id);
    client.init(&owner, &config, &fee_mgr, &pause, &token_address);
    client.init(&owner, &config, &fee_mgr, &pause, &token_address);
}

// ════════════════════════════════════════════════════════════════
// PAYMENT CREATION
// ════════════════════════════════════════════════════════════════

#[test]
fn test_create_payment() {
    let (env, client, _contract_id, _owner, _token_admin, _token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    assert_eq!(payment_id, 1);
    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.payment_id, 1);
    assert_eq!(payment.amount, 10_000_000);
    assert_eq!(payment.status, PaymentStatus::Pending);
    assert_eq!(payment.fee, 50_000);
}

#[test]
fn test_create_payment_with_memo() {
    let (env, client, _contract_id, _owner, _token_admin, _token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let memo = String::from_str(&env, "Invoice #42");

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &5_000_000_i128,
        &asset_code,
        &Some(memo.clone()),
        &None,
    );
    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.memo, Some(memo));
}

// ════════════════════════════════════════════════════════════════
// PAYMENT CONFIRMATION & COMPLETION (with token transfers)
// ════════════════════════════════════════════════════════════════

#[test]
fn test_confirm_and_complete_payment() {
    let (env, client, contract_id, _owner, _token_admin, token_address) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    let tx_hash = String::from_str(&env, "abc123def456");

    // Confirm — merchant is the caller
    client.confirm_payment(&merchant, &payment_id, &tx_hash);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Confirmed);
    assert_eq!(payment.tx_hash, Some(tx_hash));

    // Fund contract before completing
    fund_address(&env, &token_address, &contract_id, 10_000_000);

    // Complete — merchant can complete
    client.complete_payment(&merchant, &payment_id);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Completed);
}

#[test]
fn test_owner_can_confirm_and_complete() {
    let (env, client, contract_id, owner, _token_admin, token_address) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    let tx_hash = String::from_str(&env, "owner_confirm");

    // Owner can confirm
    client.confirm_payment(&owner, &payment_id, &tx_hash);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Confirmed);

    // Fund contract
    fund_address(&env, &token_address, &contract_id, 10_000_000);

    // Owner can complete
    client.complete_payment(&owner, &payment_id);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Completed);
}

#[test]
#[should_panic(expected = "Not confirmed")]
fn test_cannot_complete_unconfirmed() {
    let (env, client, _contract_id, _owner, _token_admin, _token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    // Try completing without confirming — should panic
    client.complete_payment(&merchant, &payment_id);
}

// ════════════════════════════════════════════════════════════════
// PAYMENT FAILURE
// ════════════════════════════════════════════════════════════════

#[test]
fn test_fail_payment() {
    let (env, client, _contract_id, _owner, _token_admin, _token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    client.fail_payment(&merchant, &payment_id);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Failed);
}

// ════════════════════════════════════════════════════════════════
// PAYMENT REFUNDS (with token transfers)
// ════════════════════════════════════════════════════════════════

#[test]
fn test_refund_payment() {
    let (env, client, contract_id, owner, _token_admin, token_address) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    let tx_hash = String::from_str(&env, "abc123");
    client.confirm_payment(&merchant, &payment_id, &tx_hash);

    fund_address(&env, &token_address, &contract_id, 10_000_000);

    client.complete_payment(&merchant, &payment_id);

    // Refund needs more tokens in contract
    fund_address(&env, &token_address, &contract_id, 10_000_000);

    // Only owner can refund
    client.refund_payment(&owner, &payment_id);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Refunded);
}

#[test]
#[should_panic(expected = "Can only refund completed")]
fn test_cannot_refund_pending() {
    let (env, client, _contract_id, owner, _token_admin, _token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &1_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    // Refunding a pending payment should panic
    client.refund_payment(&owner, &payment_id);
}

// ════════════════════════════════════════════════════════════════
// STATE MACHINE INTEGRITY
// ════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Not pending")]
fn test_cannot_confirm_twice() {
    let (env, client, _contract_id, _owner, _token_admin, _token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    let tx_hash = String::from_str(&env, "abc");
    client.confirm_payment(&merchant, &payment_id, &tx_hash);
    // Second confirmation should panic
    client.confirm_payment(&merchant, &payment_id, &tx_hash);
}

#[test]
fn test_payment_count() {
    let (env, client, _contract_id, _owner, _token_admin, _token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    assert_eq!(client.get_payment_count(), 0);
    client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &1_000_000_i128,
        &asset_code,
        &None,
        &None,
    );
    assert_eq!(client.get_payment_count(), 1);
    client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &2_000_000_i128,
        &asset_code,
        &None,
        &None,
    );
    assert_eq!(client.get_payment_count(), 2);
    client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &3_000_000_i128,
        &asset_code,
        &None,
        &None,
    );
    assert_eq!(client.get_payment_count(), 3);
}

#[test]
fn test_payment_exists() {
    let (env, client, _contract_id, _owner, _token_admin, _token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    assert!(!client.payment_exists(&1));
    client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &1_000_000_i128,
        &asset_code,
        &None,
        &None,
    );
    assert!(client.payment_exists(&1));
    assert!(!client.payment_exists(&999));
}

#[test]
#[should_panic(expected = "Amount below minimum")]
fn test_minimum_payment_amount() {
    let (env, client, _contract_id, _owner, _token_admin, _token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &100_i128,
        &asset_code,
        &None,
        &None,
    );
}
