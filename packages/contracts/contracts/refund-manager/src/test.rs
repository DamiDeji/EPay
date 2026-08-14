//! RefundManager tests — Stellar/Soroban

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

use super::*;

fn setup_test() -> (Env, RefundManagerClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();

    let contract_id = env.register_contract(None, RefundManager);
    let client = RefundManagerClient::new(&env, &contract_id);
    client.init(&owner, &token_address);

    (env, client, contract_id, owner, token_admin)
}

fn fund_address(env: &Env, token_address: &Address, recipient: &Address, amount: i128) {
    let token_client = token::StellarAssetClient::new(env, token_address);
    token_client.mint(recipient, &amount);
}

#[test]
fn test_initialize() {
    let (_env, client, _contract_id, _owner, _token_admin) = setup_test();
    let _ = client.get_token_address();
}

#[test]
fn test_request_refund() {
    let (env, client, _contract_id, _owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let reason = String::from_str(&env, "Customer returned item");

    let refund_id = client.request_refund(
        &merchant,
        &payer,
        &1,               // payment_id
        &5_000_000_i128,  // refund amount
        &10_000_000_i128, // original amount
        &asset_code,
        &reason,
    );

    let refund = client.get_refund(&refund_id).unwrap();
    assert_eq!(refund.status, RefundStatus::Requested);
    assert_eq!(refund.amount, 5_000_000);
    assert!(refund.is_partial); // 5M < 10M
}

#[test]
fn test_full_refund_not_partial() {
    let (env, client, _contract_id, _owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let reason = String::from_str(&env, "Full refund");

    let refund_id = client.request_refund(
        &merchant,
        &payer,
        &1,
        &10_000_000_i128,
        &10_000_000_i128,
        &asset_code,
        &reason,
    );

    let refund = client.get_refund(&refund_id).unwrap();
    assert!(!refund.is_partial); // same amounts = full refund
}

#[test]
fn test_approve_refund() {
    let (env, client, _contract_id, owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let reason = String::from_str(&env, "Refund request");

    let refund_id = client.request_refund(
        &merchant,
        &payer,
        &1,
        &5_000_000_i128,
        &10_000_000_i128,
        &asset_code,
        &reason,
    );

    client.approve_refund(&owner, &refund_id);

    let refund = client.get_refund(&refund_id).unwrap();
    assert_eq!(refund.status, RefundStatus::Approved);
}

#[test]
fn test_complete_refund() {
    let (env, client, contract_id, owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let reason = String::from_str(&env, "Refund");

    let refund_id = client.request_refund(
        &merchant,
        &payer,
        &1,
        &5_000_000_i128,
        &10_000_000_i128,
        &asset_code,
        &reason,
    );

    client.approve_refund(&owner, &refund_id);

    // Fund the contract so it can transfer to payer
    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &contract_id, 5_000_000);

    client.complete_refund(&owner, &refund_id);

    let refund = client.get_refund(&refund_id).unwrap();
    assert_eq!(refund.status, RefundStatus::Completed);
}

#[test]
fn test_reject_refund() {
    let (env, client, _contract_id, owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let reason = String::from_str(&env, "Invalid reason");

    let refund_id = client.request_refund(
        &merchant,
        &payer,
        &1,
        &5_000_000_i128,
        &10_000_000_i128,
        &asset_code,
        &reason,
    );

    client.reject_refund(&owner, &refund_id);

    let refund = client.get_refund(&refund_id).unwrap();
    assert_eq!(refund.status, RefundStatus::Rejected);
}

#[test]
fn test_refund_exists() {
    let (env, client, _contract_id, _owner, _token_admin) = setup_test();

    assert!(!client.refund_exists(&1));

    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let reason = String::from_str(&env, "Test");

    client.request_refund(
        &merchant,
        &payer,
        &1,
        &1_000_000_i128,
        &2_000_000_i128,
        &asset_code,
        &reason,
    );

    assert!(client.refund_exists(&1));
    assert!(!client.refund_exists(&999));
}
