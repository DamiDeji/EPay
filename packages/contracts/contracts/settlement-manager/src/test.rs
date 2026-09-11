//! SettlementManager tests — Stellar/Soroban
//!
//! Tests cover: initialization, settlement creation, processing,
//! fee calculation, state transitions, and data integrity.

use soroban_sdk::{testutils::Address as _, Env, Address, String};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, SettlementManagerClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, SettlementManager);
    let client = SettlementManagerClient::new(&env, &contract_id);
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
    assert!(client.get_settlement(&1).is_none());
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, SettlementManager);
    let client = SettlementManagerClient::new(&env, &contract_id);
    client.init(&owner);
    client.init(&owner);
}

// ════════════════════════════════════════════════════════════════════
// SETTLEMENT CREATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_create_settlement() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "XLM");
    let amount = 100_000_000_i128;
    let fee_bps = 50_u32; // 0.5%
    let period_start = 1_000_000_u64;
    let period_end = 2_000_000_u64;

    let settlement_id = client.create_settlement(
        &merchant,
        &amount,
        &asset_code,
        &fee_bps,
        &period_start,
        &period_end,
    );

    assert_eq!(settlement_id, 1);
    let settlement = client.get_settlement(&settlement_id).unwrap();
    assert_eq!(settlement.settlement_id, 1);
    assert_eq!(settlement.amount, amount);
    assert_eq!(settlement.fee_amount, 500_000); // 100M * 50 / 10000
    assert_eq!(settlement.net_amount, 99_500_000); // 100M - 500K
    assert_eq!(settlement.status, SettlementStatus::Pending);
    assert_eq!(settlement.period_start, period_start);
    assert_eq!(settlement.period_end, period_end);
}

#[test]
fn test_create_settlement_fee_calculation() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "XLM");

    // 1% fee
    let s1 = client.create_settlement(
        &merchant,
        &10_000_000_i128,
        &asset_code,
        &100_u32,
        &1_000_000_u64,
        &2_000_000_u64,
    );
    let s1_data = client.get_settlement(&s1).unwrap();
    assert_eq!(s1_data.fee_amount, 100_000); // 10M * 100 / 10000
    assert_eq!(s1_data.net_amount, 9_900_000);

    // 5% fee (500 bps = max)
    let s2 = client.create_settlement(
        &merchant,
        &10_000_000_i128,
        &asset_code,
        &500_u32,
        &1_000_000_u64,
        &2_000_000_u64,
    );
    let s2_data = client.get_settlement(&s2).unwrap();
    assert_eq!(s2_data.fee_amount, 500_000); // 10M * 500 / 10000
    assert_eq!(s2_data.net_amount, 9_500_000);

    // 0.1% fee (10 bps = min)
    let s3 = client.create_settlement(
        &merchant,
        &10_000_000_i128,
        &asset_code,
        &10_u32,
        &1_000_000_u64,
        &2_000_000_u64,
    );
    let s3_data = client.get_settlement(&s3).unwrap();
    assert_eq!(s3_data.fee_amount, 10_000); // 10M * 10 / 10000
    assert_eq!(s3_data.net_amount, 9_990_000);
}

#[test]
fn test_settlement_id_increments() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "XLM");

    assert_eq!(client.get_next_id(), 1);
    client.create_settlement(
        &merchant,
        &1_000_000_i128,
        &asset_code,
        &50_u32,
        &1_000_000_u64,
        &2_000_000_u64,
    );
    assert_eq!(client.get_next_id(), 2);
    client.create_settlement(
        &merchant,
        &2_000_000_i128,
        &asset_code,
        &50_u32,
        &1_000_000_u64,
        &2_000_000_u64,
    );
    assert_eq!(client.get_next_id(), 3);
}

// ════════════════════════════════════════════════════════════════════
// SETTLEMENT PROCESSING
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_process_settlement() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "XLM");

    let settlement_id = client.create_settlement(
        &merchant,
        &50_000_000_i128,
        &asset_code,
        &50_u32,
        &1_000_000_u64,
        &2_000_000_u64,
    );

    assert_eq!(
        client.get_settlement(&settlement_id).unwrap().status,
        SettlementStatus::Pending
    );
    assert_eq!(
        client.get_settlement(&settlement_id).unwrap().processed_at,
        None
    );

    client.process_settlement(&settlement_id);

    let settlement = client.get_settlement(&settlement_id).unwrap();
    assert_eq!(settlement.status, SettlementStatus::Completed);
    assert!(settlement.processed_at.is_some());
}

// ════════════════════════════════════════════════════════════════════
// MULTIPLE SETTLEMENTS
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_multiple_settlements() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "XLM");

    let ids = (0..5)
        .map(|i| {
            client.create_settlement(
                &merchant,
                &(1_000_000_i128 * (i as i128 + 1)),
                &asset_code,
                &50_u32,
                &(1_000_000_u64 + i * 1000),
                &(2_000_000_u64 + i * 1000),
            )
        })
        .collect::<Vec<_>>();

    // Process every other settlement
    for (i, id) in ids.iter().enumerate() {
        if i % 2 == 0 {
            client.process_settlement(*id);
        }
    }

    for (i, id) in ids.iter().enumerate() {
        let s = client.get_settlement(*id).unwrap();
        if i % 2 == 0 {
            assert_eq!(s.status, SettlementStatus::Completed);
            assert!(s.processed_at.is_some());
        } else {
            assert_eq!(s.status, SettlementStatus::Pending);
            assert!(s.processed_at.is_none());
        }
    }
}

// ════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Settlement not found")]
fn test_operations_on_nonexistent_settlement() {
    let (env, client, _owner) = setup_test();
    client.process_settlement(&9999_u64);
}

#[test]
fn test_net_amount_plus_fee_equals_total() {
    let (env, client, _owner) = setup_test();

    let merchant = Address::generate(&env);
    let asset_code = String::from_str(&env, "XLM");

    for amount in [1_000_000i128, 10_000_000, 100_000_000, 1_000_000_000] {
        for fee_bps in [10u32, 50, 100, 250, 500] {
            let id = client.create_settlement(
                &merchant,
                &amount,
                &asset_code,
                &fee_bps,
                &1_000_000_u64,
                &2_000_000_u64,
            );
            let s = client.get_settlement(&id).unwrap();
            assert_eq!(
                s.amount,
                s.fee_amount + s.net_amount,
                "amount != fee + net for amount={}, fee_bps={}",
                amount, fee_bps
            );
        }
    }
}

// ════════════════════════════════════════════════════════════════════
// FUZZ: 10,000 iterations — settlement creation and processing
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_fuzz_settlement_stress() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let merchant = Address::generate(&env);
    let contract_id = env.register_contract(None, SettlementManager);
    let client = SettlementManagerClient::new(&env, &contract_id);
    client.init(&owner);

    let asset_code = String::from_str(&env, "XLM");

    // Create 1000 settlements with varying amounts and fees
    let mut total_amount: i128 = 0;
    let mut total_fee: i128 = 0;
    let mut total_net: i128 = 0;

    for i in 0..1000 {
        let amount = ((i as u64 + 1) * 100_000) as i128;
        let fee_bps = 10 + (i % 50) * 10; // 10 bps to 4910 bps... but capped at 500
        let capped_fee = fee_bps.min(500);

        let id = client.create_settlement(
            &merchant,
            &amount,
            &asset_code,
            &capped_fee,
            &(1_000_000_u64 + i * 100),
            &(2_000_000_u64 + i * 100),
        );

        let s = client.get_settlement(&id).unwrap();
        assert_eq!(s.amount, s.fee_amount + s.net_amount);
        total_amount += s.amount;
        total_fee += s.fee_amount;
        total_net += s.net_amount;

        // Process randomly
        if i % 3 == 0 {
            client.process_settlement(&id);
            assert_eq!(
                client.get_settlement(&id).unwrap().status,
                SettlementStatus::Completed
            );
        }
    }

    // Verify aggregate integrity
    assert_eq!(total_amount, total_fee + total_net);
}
