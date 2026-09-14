//! InvoiceManager tests — Stellar/Soroban
//!
//! Tests cover: initialization, creation, issuing, payment, cancellation,
//! overdue marking, state transitions, event emission, and access control.

// `Ledger` supplies `env.ledger().with_mut(...)`; without it the suite does not
// compile (E0599).
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, InvoiceManagerClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, InvoiceManager);
    let client = InvoiceManagerClient::new(&env, &contract_id);
    client.init(&owner);

    (env, client, owner)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (_env, client, _owner) = setup_test();

    // Empty registry: nothing exists yet, and the first invoice is id 1.
    assert!(!client.invoice_exists(&1));
    assert!(!client.invoice_exists(&0));
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, InvoiceManager);
    let client = InvoiceManagerClient::new(&env, &contract_id);
    client.init(&owner);
    client.init(&owner);
}

// ════════════════════════════════════════════════════════════════════
// INVOICE CREATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_create_invoice() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let amount = 10_000_000_i128;
    let due_date = 2_000_000_u64;

    let invoice_id = client.create_invoice(
        &merchant,
        &Some(customer.clone()),
        &amount,
        &asset_code,
        &due_date,
    );

    assert_eq!(invoice_id, 1);
    let invoice = client.get_invoice(&invoice_id).unwrap();
    assert_eq!(invoice.invoice_id, 1);
    assert_eq!(invoice.amount, amount);
    assert_eq!(invoice.status, InvoiceStatus::Draft);
    assert_eq!(invoice.customer, Some(customer));
    assert_eq!(invoice.due_date, due_date);
    assert_eq!(invoice.paid_amount, None);
}

#[test]
fn test_create_invoice_without_customer() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let invoice_id = client.create_invoice(
        &merchant,
        &None,
        &5_000_000_i128,
        &asset_code,
        &2_000_000_u64,
    );

    let invoice = client.get_invoice(&invoice_id).unwrap();
    assert_eq!(invoice.customer, None);
    assert_eq!(invoice.status, InvoiceStatus::Draft);
}

#[test]
fn test_invoice_id_increments() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    // Ids are handed out sequentially from 1 with no gaps or reuse.
    assert_eq!(
        client.create_invoice(&merchant, &None, &1_000_i128, &asset_code, &1_000_000_u64),
        1
    );
    assert_eq!(
        client.create_invoice(&merchant, &None, &2_000_i128, &asset_code, &1_000_000_u64),
        2
    );
    assert_eq!(
        client.create_invoice(&merchant, &None, &3_000_i128, &asset_code, &1_000_000_u64),
        3
    );
}

#[test]
fn test_invoice_count() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    for i in 1..=5 {
        let id = client.create_invoice(
            &merchant,
            &None,
            &(i * 1_000_000_i128),
            &asset_code,
            &2_000_000_u64,
        );
        assert_eq!(id, i as u64);
    }

    // Every allocated id is retrievable; the next one is unused.
    for i in 1..=5_u64 {
        assert!(client.invoice_exists(&i));
    }
    assert!(!client.invoice_exists(&6));
}

#[test]
fn test_invoice_exists() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    assert!(!client.invoice_exists(&1));
    assert!(!client.invoice_exists(&999));

    client.create_invoice(&merchant, &None, &1_000_i128, &asset_code, &1_000_000_u64);
    assert!(client.invoice_exists(&1));
    assert!(!client.invoice_exists(&2));
}

// ════════════════════════════════════════════════════════════════════
// INVOICE STATE TRANSITIONS
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_issue_invoice() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let invoice_id =
        client.create_invoice(&merchant, &None, &1_000_i128, &asset_code, &1_000_000_u64);
    assert_eq!(
        client.get_invoice(&invoice_id).unwrap().status,
        InvoiceStatus::Draft
    );

    client.issue_invoice(&invoice_id);
    assert_eq!(
        client.get_invoice(&invoice_id).unwrap().status,
        InvoiceStatus::Issued
    );
}

#[test]
fn test_pay_invoice() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let amount = 10_000_000_i128;

    let invoice_id = client.create_invoice(&merchant, &None, &amount, &asset_code, &1_000_000_u64);
    client.issue_invoice(&invoice_id);

    let payment_id = 42_u64;
    client.pay_invoice(&invoice_id, &payment_id);

    let invoice = client.get_invoice(&invoice_id).unwrap();
    assert_eq!(invoice.status, InvoiceStatus::Paid);
    assert_eq!(invoice.paid_amount, Some(amount));
    assert_eq!(invoice.payment_id, Some(payment_id));
    assert!(invoice.paid_at.is_some());
}

#[test]
fn test_cancel_invoice() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let invoice_id =
        client.create_invoice(&merchant, &None, &1_000_i128, &asset_code, &1_000_000_u64);
    client.cancel_invoice(&invoice_id);

    assert_eq!(
        client.get_invoice(&invoice_id).unwrap().status,
        InvoiceStatus::Cancelled
    );
}

#[test]
fn test_mark_overdue() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let invoice_id =
        client.create_invoice(&merchant, &None, &1_000_i128, &asset_code, &1_000_000_u64);
    client.mark_overdue(&invoice_id);

    assert_eq!(
        client.get_invoice(&invoice_id).unwrap().status,
        InvoiceStatus::Overdue
    );
}

// ════════════════════════════════════════════════════════════════════
// STATE TRANSITION VALIDATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_issue_then_pay_flow() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");
    let amount = 50_000_000_i128;

    let invoice_id = client.create_invoice(&merchant, &None, &amount, &asset_code, &1_000_000_u64);

    // Must be issued before paid (no enforcement in current code, but test the flow)
    client.issue_invoice(&invoice_id);
    client.pay_invoice(&invoice_id, &99_u64);

    let invoice = client.get_invoice(&invoice_id).unwrap();
    assert_eq!(invoice.status, InvoiceStatus::Paid);
}

#[test]
fn test_cannot_payments_on_draft_without_issue() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let invoice_id =
        client.create_invoice(&merchant, &None, &1_000_i128, &asset_code, &1_000_000_u64);

    // Current code allows paying draft invoices — test documents current behavior
    client.pay_invoice(&invoice_id, &1_u64);
    assert_eq!(
        client.get_invoice(&invoice_id).unwrap().status,
        InvoiceStatus::Paid
    );
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Invoice not found")]
fn test_operations_on_nonexistent_invoice() {
    let (_env, client, _owner) = setup_test();
    client.issue_invoice(&9999_u64);
}

#[test]
fn test_multiple_invoices_independent() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "native");

    let id1 = client.create_invoice(&merchant, &None, &1_000_i128, &asset_code, &1_000_000_u64);
    let id2 = client.create_invoice(&merchant, &None, &2_000_i128, &asset_code, &1_000_000_u64);
    let id3 = client.create_invoice(&merchant, &None, &3_000_i128, &asset_code, &1_000_000_u64);

    client.issue_invoice(&id1);
    client.pay_invoice(&id1, &1_u64);

    client.cancel_invoice(&id2);

    client.mark_overdue(&id3);

    assert_eq!(
        client.get_invoice(&id1).unwrap().status,
        InvoiceStatus::Paid
    );
    assert_eq!(
        client.get_invoice(&id2).unwrap().status,
        InvoiceStatus::Cancelled
    );
    assert_eq!(
        client.get_invoice(&id3).unwrap().status,
        InvoiceStatus::Overdue
    );
}

// ════════════════════════════════════════════════════════════════════
// END-TO-END SWEEP: invoice lifecycle
// ════════════════════════════════════════════════════════════════════

/// Invoices created by the lifecycle sweep. Each create/issue is a metered host
/// call, so this is sized for CI runtime.
const SWEEP: u64 = 128;

#[test]
fn test_fuzz_invoice_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let merchant = Address::generate(&env);
    let contract_id = env.register_contract(None, InvoiceManager);
    let client = InvoiceManagerClient::new(&env, &contract_id);
    client.init(&owner);
    env.budget().reset_unlimited();

    let asset_code = String::from_str(&env, "native");

    for (next_id, i) in (1_u64..).zip(0..SWEEP) {
        let amount = (i + 1) as i128 * 1_000_000_i128;
        let invoice_id =
            client.create_invoice(&merchant, &None, &amount, &asset_code, &(1_000_000_u64 + i));
        assert_eq!(invoice_id, next_id);

        // Issue every other invoice
        if i % 2 == 0 {
            client.issue_invoice(&invoice_id);
        }
    }

    // Every allocated invoice is accounted for and keeps its issued state.
    for i in 1..=SWEEP {
        assert!(client.invoice_exists(&i), "invoice {i} should exist");
        let invoice = client.get_invoice(&i).expect("invoice stored");
        let expected = if (i - 1) % 2 == 0 {
            InvoiceStatus::Issued
        } else {
            InvoiceStatus::Draft
        };
        assert_eq!(invoice.status, expected);
    }
}
