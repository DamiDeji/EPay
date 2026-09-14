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

/// Helper: mint tokens to an address from the token admin.
fn fund_address(env: &Env, token_address: &Address, recipient: &Address, amount: i128) {
    let token_client = token::StellarAssetClient::new(env, token_address);
    token_client.mint(recipient, &amount);
}

/// Helper: token balance of an address.
fn balance_of(env: &Env, token_address: &Address, of: &Address) -> i128 {
    token::Client::new(env, token_address).balance(of)
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
    let (env, client, _contract_id, _owner, token_admin, token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token, &payer, 10_000_000);

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

    // Creating a payment moves the payer's tokens into the router, so the
    // record is always backed by funds the contract holds.
    let _ = token_admin;
    assert_eq!(balance_of(&env, &token, &payer), 0);
}

#[test]
#[should_panic]
fn test_create_payment_requires_funds() {
    let (env, client, _contract_id, _owner, _token_admin, token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    // The payer has no balance, so the transfer inside `create_payment` fails.
    client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    let _ = token;
}

#[test]
fn test_create_payment_with_memo() {
    let (env, client, _contract_id, _owner, _token_admin, token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let memo = String::from_str(&env, "Invoice #42");

    fund_address(&env, &token, &payer, 5_000_000);

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

    // The payer funds the payment; `create_payment` moves it into the router.
    fund_address(&env, &token_address, &payer, 10_000_000);

    let payment_id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    assert_eq!(balance_of(&env, &token_address, &contract_id), 10_000_000);

    let tx_hash = String::from_str(&env, "abc123def456");

    // Confirm — merchant is the caller
    client.confirm_payment(&merchant, &payment_id, &tx_hash);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Confirmed);
    assert_eq!(payment.tx_hash, Some(tx_hash));

    // Complete — merchant can complete
    client.complete_payment(&merchant, &payment_id);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Completed);

    // Conservation of funds: the recipient receives amount - fee and the router
    // retains exactly the fee.
    assert_eq!(balance_of(&env, &token_address, &recipient), 9_950_000);
    assert_eq!(balance_of(&env, &token_address, &contract_id), 50_000);
}

#[test]
fn test_owner_can_confirm_and_complete() {
    let (env, client, contract_id, owner, _token_admin, token_address) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token_address, &payer, 10_000_000);

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

    // Owner can complete
    client.complete_payment(&owner, &payment_id);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Completed);
    assert_eq!(balance_of(&env, &token_address, &contract_id), 50_000);
}

#[test]
#[should_panic(expected = "Not confirmed")]
fn test_cannot_complete_unconfirmed() {
    let (env, client, _contract_id, _owner, _token_admin, token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token, &payer, 10_000_000);

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
    let (env, client, _contract_id, _owner, _token_admin, token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token, &payer, 10_000_000);

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
fn test_refund_payment_returns_retained_fee() {
    let (env, client, contract_id, owner, _token_admin, token_address) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token_address, &payer, 10_000_000);

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
    client.complete_payment(&merchant, &payment_id);

    // After completion the router's remaining liability for this payment is the
    // fee it retained; the net amount is with the recipient.
    assert_eq!(balance_of(&env, &token_address, &contract_id), 50_000);

    // Only owner can refund
    client.refund_payment(&owner, &payment_id);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Refunded);

    // The refund is fund-conserving: the payer gets exactly what the contract
    // held, and the contract is left with nothing for this payment.
    assert_eq!(balance_of(&env, &token_address, &payer), 50_000);
    assert_eq!(balance_of(&env, &token_address, &contract_id), 0);
}

#[test]
fn test_refund_cannot_drain_another_payments_funds() {
    let (env, client, contract_id, owner, _token_admin, token_address) = setup_test();

    let payer_a = Address::generate(&env);
    let payer_b = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token_address, &payer_a, 10_000_000);
    fund_address(&env, &token_address, &payer_b, 10_000_000);

    // Payment A completes, leaving only its fee behind.
    let id_a = client.create_payment(
        &merchant,
        &payer_a,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );
    let tx_hash = String::from_str(&env, "a");
    client.confirm_payment(&merchant, &id_a, &tx_hash);
    client.complete_payment(&merchant, &id_a);

    // Payment B is still open, so its 10_000_000 is held by the router.
    let _id_b = client.create_payment(
        &merchant,
        &payer_b,
        &recipient,
        &10_000_000_i128,
        &asset_code,
        &None,
        &None,
    );

    // Refunding A must not take B's escrowed principal. Before the accounting
    // fix this call pulled the full 10_000_000 out of the router, which then
    // made B's own completion fail for lack of balance.
    client.refund_payment(&owner, &id_a);

    // Router must still hold B's principal, untouched by A's refund.
    assert_eq!(balance_of(&env, &token_address, &contract_id), 10_000_000);

    // Now prove B can still be completed. This is the real regression guard.
    client.confirm_payment(&merchant, &_id_b, &tx_hash);
    client.complete_payment(&merchant, &_id_b);
}

#[test]
fn test_payer_balance_conserved_across_full_lifecycle() {
    let (env, client, _contract_id, owner, _token_admin, token_address) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let amount = 10_000_000_i128;
    fund_address(&env, &token_address, &payer, amount);

    let id = client.create_payment(
        &merchant,
        &payer,
        &recipient,
        &amount,
        &asset_code,
        &None,
        &None,
    );
    let tx_hash = String::from_str(&env, "lifecycle");
    client.confirm_payment(&merchant, &id, &tx_hash);
    client.complete_payment(&merchant, &id);
    client.refund_payment(&owner, &id);

    // amount = recipient's net + payer's refunded fee + the platform fee that
    // remains in the router (zero here, because the fee was refunded).
    let recipient_got = balance_of(&env, &token_address, &recipient);
    let payer_got_back = balance_of(&env, &token_address, &payer);
    assert_eq!(recipient_got + payer_got_back, amount);
}

#[test]
#[should_panic(expected = "Can only refund completed")]
fn test_cannot_refund_pending() {
    let (env, client, _contract_id, owner, _token_admin, token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token, &payer, 1_000_000);

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
    let (env, client, _contract_id, _owner, _token_admin, token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token, &payer, 10_000_000);

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
    let (env, client, _contract_id, _owner, _token_admin, token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token, &payer, 6_000_000);

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
    let (env, client, _contract_id, _owner, _token_admin, token) = setup_test();

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    fund_address(&env, &token, &payer, 1_000_000);

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
