//! TreasuryVault tests — Stellar/Soroban

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

use super::*;

fn setup_test() -> (Env, TreasuryVaultClient<'static>, Address, Address) {
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

    let contract_id = env.register_contract(None, TreasuryVault);
    let client = TreasuryVaultClient::new(&env, &contract_id);
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

#[test]
fn test_initialize() {
    let (_env, client, _owner, _token_admin) = setup_test();
    let _ = client.get_token_address();
    assert_eq!(client.get_tx_count(), 0);
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

    let contract_id = env.register_contract(None, TreasuryVault);
    let client = TreasuryVaultClient::new(&env, &contract_id);
    client.init(&owner, &token_address);
    client.init(&owner, &token_address);
}

#[test]
fn test_deposit() {
    let (env, client, owner, _token_admin) = setup_test();

    let from = Address::generate(&env);
    let token_address = client.get_token_address();
    let asset_code = String::from_str(&env, "native");
    fund_address(&env, &token_address, &from, 5_000_000);

    // Both owner (admin) and from must authorize
    let tx_id = client.deposit(&owner, &from, &1_000_000_i128, &asset_code);

    let tx = client.get_transaction(&tx_id).unwrap();
    assert_eq!(tx.tx_type, TxType::Deposit);
    assert_eq!(tx.amount, 1_000_000);
    assert_eq!(tx.status, TxStatus::Completed);
}

#[test]
fn test_deposit_moves_tokens() {
    let (env, client, owner, _token_admin) = setup_test();

    let from = Address::generate(&env);
    let token_address = client.get_token_address();
    let asset_code = String::from_str(&env, "native");
    fund_address(&env, &token_address, &from, 5_000_000);

    let contract_id = env.current_contract_address();
    let from_before = get_balance(&env, &token_address, &from);
    let vault_before = get_balance(&env, &token_address, &contract_id);

    client.deposit(&owner, &from, &1_000_000_i128, &asset_code);

    // Depositor debited exactly the deposit amount; vault credited
    assert_eq!(
        get_balance(&env, &token_address, &from),
        from_before - 1_000_000
    );
    assert_eq!(
        get_balance(&env, &token_address, &contract_id),
        vault_before + 1_000_000
    );
}

#[test]
fn test_withdraw() {
    let (env, client, owner, _token_admin) = setup_test();

    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let token_address = client.get_token_address();
    let asset_code = String::from_str(&env, "native");
    fund_address(&env, &token_address, &from, 5_000_000);

    // First deposit to fill the vault
    client.deposit(&owner, &from, &5_000_000_i128, &asset_code);

    // Then withdraw
    let tx_id = client.withdraw(&owner, &to, &1_000_000_i128, &asset_code);

    let tx = client.get_transaction(&tx_id).unwrap();
    assert_eq!(tx.tx_type, TxType::Withdrawal);
    assert_eq!(tx.amount, 1_000_000);
    assert_eq!(tx.status, TxStatus::Completed);
}

#[test]
fn test_withdraw_moves_tokens() {
    let (env, client, owner, _token_admin) = setup_test();

    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let token_address = client.get_token_address();
    let asset_code = String::from_str(&env, "native");
    fund_address(&env, &token_address, &from, 5_000_000);
    client.deposit(&owner, &from, &5_000_000_i128, &asset_code);

    let contract_id = env.current_contract_address();
    let vault_before = get_balance(&env, &token_address, &contract_id);
    let to_before = get_balance(&env, &token_address, &to);

    client.withdraw(&owner, &to, &2_000_000_i128, &asset_code);

    // Vault debited, recipient credited
    assert_eq!(
        get_balance(&env, &token_address, &contract_id),
        vault_before - 2_000_000
    );
    assert_eq!(
        get_balance(&env, &token_address, &to),
        to_before + 2_000_000
    );
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_withdraw_not_owner() {
    let (env, client, owner, _token_admin) = setup_test();

    let from = Address::generate(&env);
    let token_address = client.get_token_address();
    let asset_code = String::from_str(&env, "native");
    fund_address(&env, &token_address, &from, 1_000_000);
    client.deposit(&owner, &from, &1_000_000_i128, &asset_code);

    let attacker = Address::generate(&env);
    let to = Address::generate(&env);
    // Non-owner must not be able to drain the vault
    client.withdraw(&attacker, &to, &1_000_000_i128, &asset_code);
}

#[test]
#[should_panic]
fn test_withdraw_insufficient_balance() {
    let (env, client, owner, _token_admin) = setup_test();

    let to = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    // Withdrawing from an empty vault must fail (token transfer reverts)
    client.withdraw(&owner, &to, &1_000_000_i128, &asset_code);
}

#[test]
fn test_record_tx() {
    let (env, client, owner, _token_admin) = setup_test();

    let asset_code = String::from_str(&env, "native");
    let ref_id = String::from_str(&env, "pay_1");

    let tx_id = client.record_tx(
        &owner,
        &TxType::FeeCollection,
        &500_i128,
        &asset_code,
        &Some(ref_id.clone()),
    );

    let tx = client.get_transaction(&tx_id).unwrap();
    assert_eq!(tx.tx_type, TxType::FeeCollection);
    assert_eq!(tx.reference_id, Some(ref_id));
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_record_tx_not_owner() {
    let (env, client, _owner, _token_admin) = setup_test();

    let attacker = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    // Non-owner must not be able to fabricate treasury accounting entries
    client.record_tx(&attacker, &TxType::FeeCollection, &500_i128, &asset_code, &None);
}

#[test]
#[should_panic(expected = "Only owner can perform this action")]
fn test_deposit_not_owner() {
    let (env, client, _owner, _token_admin) = setup_test();

    let from = Address::generate(&env);
    let not_owner = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    // This should panic because not_owner is not the owner
    client.deposit(&not_owner, &from, &1_000_000_i128, &asset_code);
}

#[test]
fn test_get_tx_count() {
    let (env, client, owner, _token_admin) = setup_test();

    let asset_code = String::from_str(&env, "native");

    assert_eq!(client.get_tx_count(), 0);

    client.record_tx(&owner, &TxType::FeeCollection, &100_i128, &asset_code, &None);
    assert_eq!(client.get_tx_count(), 1);

    client.record_tx(&owner, &TxType::FeeCollection, &200_i128, &asset_code, &None);
    assert_eq!(client.get_tx_count(), 2);
}
