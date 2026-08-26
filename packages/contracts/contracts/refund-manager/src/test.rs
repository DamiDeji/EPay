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

fn get_balance(env: &Env, token_address: &Address, addr: &Address) -> i128 {
    token::Client::new(env, token_address).balance(addr)
}

/// Request a refund and return its ID.
fn request_refund(
    env: &Env,
    client: &RefundManagerClient<'static>,
    amount: i128,
    original_amount: i128,
) -> u64 {
    let merchant = Address::generate(env);
    let payer = Address::generate(env);
    let asset_code = String::from_str(env, "native");
    let reason = String::from_str(env, "Refund request");

    client.request_refund(
        &merchant,
        &payer,
        &1,
        &amount,
        &original_amount,
        &asset_code,
        &reason,
    )
}

#[test]
fn test_initialize() {
    let (_env, client, _contract_id, _owner, _token_admin) = setup_test();
    let _ = client.get_token_address();
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();

    let contract_id = env.register_contract(None, RefundManager);
    let client = RefundManagerClient::new(&env, &contract_id);
    client.init(&owner, &token_address);
    client.init(&owner, &token_address);
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
#[should_panic(expected = "Refund amount must be positive")]
fn test_request_refund_zero_amount() {
    let (env, client, _contract_id, _owner, _token_admin) = setup_test();
    request_refund(&env, &client, 0, 10_000_000);
}

#[test]
#[should_panic(expected = "Refund amount must be positive")]
fn test_request_refund_negative_amount() {
    let (env, client, _contract_id, _owner, _token_admin) = setup_test();
    request_refund(&env, &client, -1_000_000, 10_000_000);
}

#[test]
#[should_panic(expected = "Refund amount exceeds original amount")]
fn test_request_refund_exceeds_original() {
    let (env, client, _contract_id, _owner, _token_admin) = setup_test();
    // Refunding more than the original payment must be impossible
    request_refund(&env, &client, 11_000_000, 10_000_000);
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
#[should_panic(expected = "Only owner can perform this action")]
fn test_approve_refund_not_owner() {
    let (env, client, _contract_id, _owner, _token_admin) = setup_test();
    let refund_id = request_refund(&env, &client, 5_000_000, 10_000_000);

    let attacker = Address::generate(&env);
    client.approve_refund(&attacker, &refund_id);
}

#[test]
#[should_panic(expected = "Refund not in requested state")]
fn test_approve_refund_twice_rejected() {
    let (env, client, _contract_id, owner, _token_admin) = setup_test();
    let refund_id = request_refund(&env, &client, 5_000_000, 10_000_000);

    client.approve_refund(&owner, &refund_id);
    // A second approval must fail — state machine is one-way
    client.approve_refund(&owner, &refund_id);
}

#[test]
#[should_panic(expected = "Refund not found")]
fn test_approve_refund_not_found() {
    let (env, client, _contract_id, owner, _token_admin) = setup_test();
    client.approve_refund(&owner, &999);
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
fn test_complete_refund_moves_tokens() {
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

    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &contract_id, 5_000_000);

    let payer_before = get_balance(&env, &token_address, &payer);
    client.complete_refund(&owner, &refund_id);

    // Payer receives exactly the refund amount; contract drained
    assert_eq!(
        get_balance(&env, &token_address, &payer),
        payer_before + 5_000_000
    );
    assert_eq!(get_balance(&env, &token_address, &contract_id), 0);
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_complete_refund_not_owner() {
    let (env, client, contract_id, owner, _token_admin) = setup_test();
    let refund_id = request_refund(&env, &client, 5_000_000, 10_000_000);
    client.approve_refund(&owner, &refund_id);

    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &contract_id, 5_000_000);

    let attacker = Address::generate(&env);
    client.complete_refund(&attacker, &refund_id);
}

#[test]
#[should_panic(expected = "Refund not approved")]
fn test_complete_refund_not_approved() {
    let (env, client, _contract_id, owner, _token_admin) = setup_test();
    let refund_id = request_refund(&env, &client, 5_000_000, 10_000_000);

    // Completing before approval must fail
    client.complete_refund(&owner, &refund_id);
}

#[test]
#[should_panic(expected = "Refund not approved")]
fn test_complete_refund_twice_rejected() {
    let (env, client, contract_id, owner, _token_admin) = setup_test();
    let refund_id = request_refund(&env, &client, 5_000_000, 10_000_000);
    client.approve_refund(&owner, &refund_id);

    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &contract_id, 10_000_000);
    client.complete_refund(&owner, &refund_id);

    // Second completion must fail — funds already returned
    client.complete_refund(&owner, &refund_id);
}

#[test]
#[should_panic]
fn test_complete_refund_insufficient_contract_balance() {
    let (env, client, _contract_id, owner, _token_admin) = setup_test();
    let refund_id = request_refund(&env, &client, 5_000_000, 10_000_000);
    client.approve_refund(&owner, &refund_id);

    // Contract holds no tokens — the payout transfer must revert
    client.complete_refund(&owner, &refund_id);
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
#[should_panic(expected = "Only owner can perform this action")]
fn test_reject_refund_not_owner() {
    let (env, client, _contract_id, _owner, _token_admin) = setup_test();
    let refund_id = request_refund(&env, &client, 5_000_000, 10_000_000);

    let attacker = Address::generate(&env);
    client.reject_refund(&attacker, &refund_id);
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
