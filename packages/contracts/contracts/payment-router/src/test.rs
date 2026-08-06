#[cfg(test)]
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

use super::*;

fn setup_test() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let config = Address::generate(&env);
    let fee_mgr = Address::generate(&env);
    let pause = Address::generate(&env);

    let contract_id = env.register_contract(None, PaymentRouter);
    let client = PaymentRouterClient::new(&env, &contract_id);

    client.init(&owner, &config, &fee_mgr, &pause);

    (env, contract_id, owner, config, fee_mgr)
}

fn create_test_client<'a>(env: &Env, contract_id: &Address) -> PaymentRouterClient<'a> {
    PaymentRouterClient::new(env, contract_id)
}

#[test]
fn test_initialize() {
    let (env, contract_id, _owner, _config, _fee_mgr) = setup_test();
    let client = create_test_client(&env, &contract_id);

    assert_eq!(client.get_next_payment_id(), 1);
    assert_eq!(client.get_payment_count(), 0);
}

#[test]
fn test_create_payment() {
    let (env, contract_id, _owner, _config, _fee_mgr) = setup_test();
    let client = create_test_client(&env, &contract_id);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);

    let asset = AssetInfo {
        code: String::from_str(&env, "native"),
        issuer: Address::generate(&env),
    };

    let payment_id = client.create_payment(
        &payer,
        &merchant,
        &recipient,
        &10_000_000_i128, // 1 XLM
        &asset,
        &None,
        &None,
    );

    assert_eq!(payment_id, 1);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.payment_id, 1);
    assert_eq!(payment.amount, 10_000_000);
    assert_eq!(payment.status, PaymentStatus::Pending);
    assert_eq!(payment.fee, 50_000); // 0.5% of 1 XLM
}

#[test]
fn test_confirm_and_complete_payment() {
    let (env, contract_id, _owner, _config, _fee_mgr) = setup_test();
    let client = create_test_client(&env, &contract_id);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);

    let asset = AssetInfo {
        code: String::from_str(&env, "native"),
        issuer: Address::generate(&env),
    };

    let payment_id = client.create_payment(
        &payer,
        &merchant,
        &recipient,
        &10_000_000_i128,
        &asset,
        &None,
        &None,
    );

    let tx_hash = String::from_str(&env, "abc123def456");

    // Confirm payment
    client.confirm_payment(&payment_id, &tx_hash);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Confirmed);
    assert_eq!(payment.tx_hash, Some(tx_hash.clone()));

    // Complete payment
    client.complete_payment(&payment_id);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Completed);
}

#[test]
fn test_fail_payment() {
    let (env, contract_id, _owner, _config, _fee_mgr) = setup_test();
    let client = create_test_client(&env, &contract_id);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);

    let asset = AssetInfo {
        code: String::from_str(&env, "native"),
        issuer: Address::generate(&env),
    };

    let payment_id = client.create_payment(
        &payer,
        &merchant,
        &recipient,
        &10_000_000_i128,
        &asset,
        &None,
        &None,
    );

    let reason = String::from_str(&env, "Insufficient funds");
    client.fail_payment(&payment_id, &reason);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Failed);
}

#[test]
fn test_refund_payment() {
    let (env, contract_id, _owner, _config, _fee_mgr) = setup_test();
    let client = create_test_client(&env, &contract_id);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);

    let asset = AssetInfo {
        code: String::from_str(&env, "native"),
        issuer: Address::generate(&env),
    };

    let payment_id = client.create_payment(
        &payer,
        &merchant,
        &recipient,
        &10_000_000_i128,
        &asset,
        &None,
        &None,
    );

    let tx_hash = String::from_str(&env, "abc123");
    client.confirm_payment(&payment_id, &tx_hash);
    client.complete_payment(&payment_id);
    client.refund_payment(&payment_id);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, PaymentStatus::Refunded);
}

#[test]
#[should_panic(expected = "Payment not in pending state")]
fn test_cannot_confirm_twice() {
    let (env, contract_id, _owner, _config, _fee_mgr) = setup_test();
    let client = create_test_client(&env, &contract_id);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);

    let asset = AssetInfo {
        code: String::from_str(&env, "native"),
        issuer: Address::generate(&env),
    };

    let payment_id = client.create_payment(
        &payer,
        &merchant,
        &recipient,
        &10_000_000_i128,
        &asset,
        &None,
        &None,
    );

    let tx_hash = String::from_str(&env, "abc");
    client.confirm_payment(&payment_id, &tx_hash);
    // Second confirmation should panic
    client.confirm_payment(&payment_id, &tx_hash);
}

#[test]
fn test_payment_count() {
    let (env, contract_id, _owner, _config, _fee_mgr) = setup_test();
    let client = create_test_client(&env, &contract_id);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = AssetInfo {
        code: String::from_str(&env, "native"),
        issuer: Address::generate(&env),
    };

    assert_eq!(client.get_payment_count(), 0);

    client.create_payment(&payer, &merchant, &recipient, &1_000_000_i128, &asset, &None, &None);
    assert_eq!(client.get_payment_count(), 1);

    client.create_payment(&payer, &merchant, &recipient, &2_000_000_i128, &asset, &None, &None);
    assert_eq!(client.get_payment_count(), 2);

    client.create_payment(&payer, &merchant, &recipient, &3_000_000_i128, &asset, &None, &None);
    assert_eq!(client.get_payment_count(), 3);
}

#[test]
fn test_payment_exists() {
    let (env, contract_id, _owner, _config, _fee_mgr) = setup_test();
    let client = create_test_client(&env, &contract_id);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = AssetInfo {
        code: String::from_str(&env, "native"),
        issuer: Address::generate(&env),
    };

    assert!(!client.payment_exists(&1));

    client.create_payment(&payer, &merchant, &recipient, &1_000_000_i128, &asset, &None, &None);
    assert!(client.payment_exists(&1));
    assert!(!client.payment_exists(&999));
}

#[test]
#[should_panic(expected = "Amount below minimum payment")]
fn test_minimum_payment_amount() {
    let (env, contract_id, _owner, _config, _fee_mgr) = setup_test();
    let client = create_test_client(&env, &contract_id);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = AssetInfo {
        code: String::from_str(&env, "native"),
        issuer: Address::generate(&env),
    };

    // Amount below minimum of 1_000_000 stroops
    client.create_payment(&payer, &merchant, &recipient, &100_i128, &asset, &None, &None);
}
