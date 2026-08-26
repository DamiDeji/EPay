//! EscrowManager tests — Stellar/Soroban

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

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
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();

    let contract_id = env.register_contract(None, EscrowManager);
    let client = EscrowManagerClient::new(&env, &contract_id);
    client.init(&owner, &token_address);

    (env, client, owner, token_admin)
}

fn fund_address(env: &Env, token_address: &Address, recipient: &Address, amount: i128) {
    let token_client = token::StellarAssetClient::new(env, token_address);
    token_client.mint(recipient, &amount);
}

fn get_balance(env: &Env, token_address: &Address, addr: &Address) -> i128 {
    token::Client::new(env, token_address).balance(addr)
}

/// Create a funded escrow of `total_amount` stroops. Returns (escrow_id, merchant, customer).
fn create_funded_escrow(
    env: &Env,
    client: &EscrowManagerClient<'static>,
    total_amount: i128,
) -> (u64, Address, Address) {
    let merchant = Address::generate(env);
    let customer = Address::generate(env);
    let asset_code = String::from_str(env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &total_amount, &asset_code);

    let token_address = client.get_token_address();
    fund_address(env, &token_address, &customer, total_amount);
    client.fund_escrow(&customer, &escrow_id);

    (escrow_id, merchant, customer)
}

#[test]
fn test_initialize() {
    let (_env, client, _owner, _token_admin) = setup_test();
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

    let contract_id = env.register_contract(None, EscrowManager);
    let client = EscrowManagerClient::new(&env, &contract_id);
    client.init(&owner, &token_address);
    client.init(&owner, &token_address);
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
    let (env, client, _owner, _token_admin) = setup_test();

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
#[should_panic(expected = "Caller is not the escrow customer")]
fn test_fund_escrow_wrong_customer() {
    let (env, client, _owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let impostor = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    // A non-customer (even one holding the tokens) must not be able to fund
    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &impostor, 10_000_000);
    client.fund_escrow(&impostor, &escrow_id);
}

#[test]
#[should_panic(expected = "Escrow not in created state")]
fn test_fund_escrow_already_funded() {
    let (env, client, _owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, customer) = create_funded_escrow(&env, &client, 10_000_000);

    // The same customer attempting to fund the (already funded) escrow again must fail
    client.fund_escrow(&customer, &escrow_id);
}

#[test]
#[should_panic(expected = "Escrow not found")]
fn test_fund_escrow_not_found() {
    let (env, client, _owner, _token_admin) = setup_test();

    let customer = Address::generate(&env);
    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &customer, 10_000_000);
    client.fund_escrow(&customer, &999);
}

#[test]
fn test_fund_escrow_moves_tokens() {
    let (env, client, _owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);
    let token_address = client.get_token_address();
    let contract_id = env.current_contract_address();
    fund_address(&env, &token_address, &customer, 10_000_000);

    let customer_before = get_balance(&env, &token_address, &customer);
    let contract_before = get_balance(&env, &token_address, &contract_id);

    client.fund_escrow(&customer, &escrow_id);

    // Customer debited exactly the escrow amount, contract credited
    assert_eq!(
        get_balance(&env, &token_address, &customer),
        customer_before - 10_000_000
    );
    assert_eq!(
        get_balance(&env, &token_address, &contract_id),
        contract_before + 10_000_000
    );
}

#[test]
fn test_dispute_escrow() {
    let (env, client, _owner, _token_admin) = setup_test();

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
#[should_panic(expected = "Only participants can dispute")]
fn test_dispute_escrow_by_third_party() {
    let (env, client, _owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, _customer) = create_funded_escrow(&env, &client, 10_000_000);

    let stranger = Address::generate(&env);
    let reason = String::from_str(&env, "Not a participant");
    client.dispute_escrow(&stranger, &escrow_id, &reason);
}

#[test]
#[should_panic(expected = "Escrow not found")]
fn test_dispute_escrow_not_found() {
    let (env, client, _owner, _token_admin) = setup_test();

    let stranger = Address::generate(&env);
    let reason = String::from_str(&env, "Ghost escrow");
    client.dispute_escrow(&stranger, &999, &reason);
}

#[test]
fn test_complete_escrow() {
    let (env, client, owner, _token_admin) = setup_test();

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
#[should_panic(expected = "Only owner can perform this action")]
fn test_complete_escrow_not_owner() {
    let (env, client, _owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, _customer) = create_funded_escrow(&env, &client, 10_000_000);

    let attacker = Address::generate(&env);
    client.complete_escrow(&attacker, &escrow_id);
}

#[test]
#[should_panic(expected = "Escrow not funded")]
fn test_complete_escrow_not_funded() {
    let (env, client, owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    // Never funded — owner must not be able to release
    client.complete_escrow(&owner, &escrow_id);
}

#[test]
#[should_panic(expected = "Escrow not found")]
fn test_complete_escrow_not_found() {
    let (env, client, owner, _token_admin) = setup_test();
    client.complete_escrow(&owner, &999);
}

#[test]
fn test_complete_escrow_pays_merchant() {
    let (env, client, owner, _token_admin) = setup_test();
    let (escrow_id, merchant, _customer) = create_funded_escrow(&env, &client, 10_000_000);

    let token_address = client.get_token_address();
    let merchant_before = get_balance(&env, &token_address, &merchant);

    client.complete_escrow(&owner, &escrow_id);

    // Merchant receives the full escrow amount; contract is drained
    assert_eq!(
        get_balance(&env, &token_address, &merchant),
        merchant_before + 10_000_000
    );
    assert_eq!(
        get_balance(&env, &token_address, &env.current_contract_address()),
        0
    );
}

#[test]
fn test_cancel_and_refund_escrow() {
    let (env, client, owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    // Fund escrow
    let token_address = client.get_token_address();
    fund_address(&env, &token_address, &customer, 10_000_000);
    client.fund_escrow(&customer, &escrow_id);

    // Dispute (required before cancellation of funded escrow)
    let reason = String::from_str(&env, "Dispute before cancel");
    client.dispute_escrow(&customer, &escrow_id, &reason);

    // Cancel by owner while disputed
    client.cancel_escrow(&owner, &escrow_id);

    let escrow = client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Cancelled);

    // Refund — return funds to customer
    client.refund_escrow(&owner, &escrow_id);

    let escrow = client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Refunded);
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_cancel_escrow_by_third_party() {
    let (env, client, _owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    let stranger = Address::generate(&env);
    client.cancel_escrow(&stranger, &escrow_id);
}

#[test]
#[should_panic(expected = "Cannot cancel in current state")]
fn test_cancel_escrow_in_funded_state() {
    let (env, client, _owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, customer) = create_funded_escrow(&env, &client, 10_000_000);

    // Participants cannot cancel a funded (non-disputed) escrow
    client.cancel_escrow(&customer, &escrow_id);
}

#[test]
#[should_panic(expected = "Cannot refund — escrow must be cancelled or disputed")]
fn test_refund_escrow_in_completed_state() {
    let (env, client, owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, _customer) = create_funded_escrow(&env, &client, 10_000_000);

    client.complete_escrow(&owner, &escrow_id);
    // Refunding a completed (funds already released) escrow must be impossible
    client.refund_escrow(&owner, &escrow_id);
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_refund_escrow_not_owner() {
    let (env, client, _owner, _token_admin) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let escrow_id = client.create_escrow(&merchant, &customer, &10_000_000_i128, &asset_code);

    let attacker = Address::generate(&env);
    client.refund_escrow(&attacker, &escrow_id);
}

#[test]
fn test_refund_escrow_returns_funds() {
    let (env, client, owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, customer) = create_funded_escrow(&env, &client, 10_000_000);

    let token_address = client.get_token_address();
    let reason = String::from_str(&env, "Refund path");
    client.dispute_escrow(&customer, &escrow_id, &reason);
    client.cancel_escrow(&owner, &escrow_id);

    let customer_before = get_balance(&env, &token_address, &customer);
    client.refund_escrow(&owner, &escrow_id);

    // Customer gets the full escrow amount back; contract is drained
    assert_eq!(
        get_balance(&env, &token_address, &customer),
        customer_before + 10_000_000
    );
    assert_eq!(
        get_balance(&env, &token_address, &env.current_contract_address()),
        0
    );
}

#[test]
#[should_panic(expected = "Cannot refund — escrow must be cancelled or disputed")]
fn test_double_refund_rejected() {
    let (env, client, owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, customer) = create_funded_escrow(&env, &client, 10_000_000);

    let reason = String::from_str(&env, "Refund twice");
    client.dispute_escrow(&customer, &escrow_id, &reason);
    client.cancel_escrow(&owner, &escrow_id);
    client.refund_escrow(&owner, &escrow_id);
    // Second refund attempt must fail — funds already returned
    client.refund_escrow(&owner, &escrow_id);
}

#[test]
fn test_resolve_dispute() {
    let (env, client, owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, customer) = create_funded_escrow(&env, &client, 10_000_000);

    let reason = String::from_str(&env, "Resolved amicably");
    client.dispute_escrow(&customer, &escrow_id, &reason);
    client.resolve_dispute(&owner, &escrow_id);

    let escrow = client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Resolved);
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_resolve_dispute_not_owner() {
    let (env, client, _owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, customer) = create_funded_escrow(&env, &client, 10_000_000);

    let reason = String::from_str(&env, "Dispute");
    client.dispute_escrow(&customer, &escrow_id, &reason);

    let attacker = Address::generate(&env);
    client.resolve_dispute(&attacker, &escrow_id);
}

#[test]
#[should_panic(expected = "Escrow not disputed")]
fn test_resolve_dispute_not_disputed() {
    let (env, client, owner, _token_admin) = setup_test();
    let (escrow_id, _merchant, _customer) = create_funded_escrow(&env, &client, 10_000_000);

    // Owner cannot resolve an escrow that was never disputed
    client.resolve_dispute(&owner, &escrow_id);
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
