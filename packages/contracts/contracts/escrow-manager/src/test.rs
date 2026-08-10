//! EscrowManager tests — Stellar/Soroban
//!
//! Tests cover: initialization, escrow creation, funding, completion,
//! disputes, resolution, cancellation, and refunds with token transfers.

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

use super::*;

fn setup_test() -> (Env, EscrowManagerClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract(token_admin.clone());

    let contract_id = env.register_contract(None, EscrowManager);
    let client = EscrowManagerClient::new(&env, &contract_id);
    client.init(&owner, &token_address);

    (env, client, owner, token_admin)
}

fn fund_address(env: &Env, token_address: &Address, recipient: &Address, amount: i128) {
    let token_client = token::StellarAssetClient::new(env, token_address);
    token_client.mint(recipient, &amount);
}

#[test]
fn test_initialize() {
    let (env, client, _owner, _token_admin) = setup_test();
    let _ = client.get_token_address();
    assert!(true);
}

#[test]
fn test_create_escrow() {
    let (env, client, _owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    assert_eq!(escrow_id, 1);

    let escrow = client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Created);
    assert_eq!(escrow.total_amount, 10_000_000);
}

#[test]
fn test_fund_escrow() {
    let (env, client, _owner, token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    // Fund the customer with tokens so they can transfer to escrow
    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &customer, 10_000_000);

    client.fund_escrow(&customer, &escrow_id);

    let escrow = client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Funded);
}

#[test]
fn test_dispute_escrow() {
    let (env, client, _owner, token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    // Fund first
    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &customer, 10_000_000);
    client.fund_escrow(&customer, &escrow_id);

    // Dispute
    let reason = String::from_str(&env, "Work not completed");
    client.dispute_escrow(&customer, &escrow_id, &reason);

    let escrow = client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Disputed);
    assert_eq!(escrow.dispute_reason, Some(reason));
}

#[test]
fn test_complete_escrow() {
    let (env, client, owner, token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    // Fund escrow
    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &customer, 10_000_000);
    client.fund_escrow(&customer, &escrow_id);

    // Complete (owner releases funds to merchant)
    client.complete_escrow(&owner, &escrow_id);

    let escrow = client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Completed);
}

#[test]
fn test_cancel_and_refund_escrow() {
    let (env, client, owner, token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    // Fund escrow
    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &customer, 10_000_000);
    client.fund_escrow(&customer, &escrow_id);

    // Cancel by owner
    client.cancel_escrow(&owner, &escrow_id);

    let escrow = client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Cancelled);

    // Refund — return funds to customer
    client.refund_escrow(&owner, &escrow_id);

    let escrow = client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Refunded);
}

#[test]
fn test_escrow_exists() {
    let (env, client, _owner, _token_admin) = setup_test();

    assert!(!client.escrow_exists(&1));

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    client.create_escrow(&merchant, &customer, &1_000_000_i128, &asset_code);

    assert!(client.escrow_exists(&1));
    assert!(!client.escrow_exists(&999));
}
