//! Property-based / fuzz tests for EscrowManager.
//!
//! Escrow holds customer funds, so the properties are about custody:
//!  * funds only ever leave the escrow contract along one of two paths — to the
//!    merchant on completion, or back to the customer on refund;
//!  * the contract's balance returns to zero after a terminal transition;
//!  * the state machine rejects illegal transitions and double-spends.
//!
//! A deterministic xorshift PRNG drives `ITERATIONS` steps; no extra dependencies.

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

use super::*;

const ITERATIONS: u32 = 256;

struct Rng(u64);

impl Rng {
    fn new(seed: u64) -> Self {
        Rng(seed | 1)
    }

    fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }

    fn amount(&mut self) -> i128 {
        (self.next_u64() % 10_000_000) as i128 + 1
    }
}

fn setup() -> (Env, EscrowManagerClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    // Each property test performs thousands of metered host calls; the
    // assertions, not the per-test CPU budget, should decide the outcome.
    env.budget().reset_unlimited();
    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();

    let contract_id = env.register_contract(None, EscrowManager);
    let client = EscrowManagerClient::new(&env, &contract_id);
    client.init(&owner, &token_address);

    (env, client, owner, contract_id)
}

fn mint(env: &Env, token_address: &Address, to: &Address, amount: i128) {
    token::StellarAssetClient::new(env, token_address).mint(to, &amount);
}

fn balance(env: &Env, token_address: &Address, of: &Address) -> i128 {
    token::Client::new(env, token_address).balance(of)
}

/// INVARIANT: a created escrow is inert, funding moves *exactly* the agreed
/// amount into the contract, completion moves exactly that amount to the
/// merchant, and the contract ends at zero. No amount is ever created or lost.
#[test]
fn fuzz_fund_and_complete_conserve_funds() {
    let (env, client, owner, contract_id) = setup();
    let token_address = client.get_token_address();
    let asset_code = String::from_str(&env, "XLM");

    let mut rng = Rng::new(0xE5C_0001);
    let mut total_settled: i128 = 0;

    for _ in 0..ITERATIONS {
        let merchant = Address::generate(&env);
        let customer = Address::generate(&env);
        let amount = rng.amount();

        mint(&env, &token_address, &customer, amount);
        let customer_before = balance(&env, &token_address, &customer);
        let merchant_before = balance(&env, &token_address, &merchant);

        let id = client.create_escrow(&merchant, &customer, &amount, &asset_code);

        let created = client.get_escrow(&id).expect("escrow stored");
        assert_eq!(created.status, EscrowStatus::Created);
        assert_eq!(created.total_amount, amount);
        // Inert until funded.
        assert_eq!(balance(&env, &token_address, &contract_id), 0);

        client.fund_escrow(&customer, &id);
        assert_eq!(
            client.get_escrow(&id).expect("escrow stored").status,
            EscrowStatus::Funded
        );
        assert_eq!(
            balance(&env, &token_address, &customer),
            customer_before - amount,
            "funding must debit exactly the escrow amount"
        );
        assert_eq!(
            balance(&env, &token_address, &contract_id),
            amount,
            "the contract must hold exactly the escrowed amount"
        );

        client.complete_escrow(&owner, &id);
        assert_eq!(
            client.get_escrow(&id).expect("escrow stored").status,
            EscrowStatus::Completed
        );
        assert_eq!(
            balance(&env, &token_address, &merchant),
            merchant_before + amount,
            "completion must credit exactly the escrowed amount to the merchant"
        );
        assert_eq!(
            balance(&env, &token_address, &contract_id),
            0,
            "the contract must not retain funds after completion"
        );

        total_settled += amount;
    }

    assert!(total_settled > 0);
}

/// INVARIANT: the refund path is the only other way funds leave, and it pays the
/// customer — never the merchant, never an arbitrary address.
#[test]
fn fuzz_cancel_then_refund_returns_funds_to_customer() {
    let (env, client, owner, contract_id) = setup();
    let token_address = client.get_token_address();
    let asset_code = String::from_str(&env, "XLM");

    let mut rng = Rng::new(0xE5C_0002);

    for _ in 0..ITERATIONS {
        let merchant = Address::generate(&env);
        let customer = Address::generate(&env);
        let amount = rng.amount();

        mint(&env, &token_address, &customer, amount);
        let customer_before = balance(&env, &token_address, &customer);

        let id = client.create_escrow(&merchant, &customer, &amount, &asset_code);
        client.fund_escrow(&customer, &id);

        // Cancel is permitted from Created or Disputed; here the escrow is Funded,
        // so a cancellation must be rejected and the funds must stay put.
        assert!(
            client.try_cancel_escrow(&customer, &id).is_err(),
            "a funded escrow must not be cancellable without dispute"
        );
        assert_eq!(balance(&env, &token_address, &contract_id), amount);

        // Refund is only permitted from Cancelled or Disputed.
        assert!(
            client.try_refund_escrow(&owner, &id).is_err(),
            "a funded escrow must not be refundable without dispute/cancellation"
        );

        // Dispute is available to the participants, then refund returns the funds.
        client.dispute_escrow(&customer, &id, &String::from_str(&env, "undelivered"));
        assert_eq!(
            client.get_escrow(&id).expect("escrow stored").status,
            EscrowStatus::Disputed
        );

        client.refund_escrow(&owner, &id);
        assert_eq!(
            client.get_escrow(&id).expect("escrow stored").status,
            EscrowStatus::Refunded
        );
        assert_eq!(
            balance(&env, &token_address, &customer),
            customer_before,
            "a refund must restore the customer's balance exactly"
        );
        assert_eq!(balance(&env, &token_address, &contract_id), 0);
    }
}

/// INVARIANT: no illegal transition can be forced. Funding twice, completing an
/// unfunded escrow, and having a non-participant dispute must all fail.
#[test]
fn fuzz_state_machine_rejects_illegal_transitions() {
    let (env, client, owner, _contract_id) = setup();
    let token_address = client.get_token_address();
    let asset_code = String::from_str(&env, "XLM");

    let mut rng = Rng::new(0xE5C_0003);

    for _ in 0..(ITERATIONS / 5) {
        let merchant = Address::generate(&env);
        let customer = Address::generate(&env);
        let outsider = Address::generate(&env);
        let amount = rng.amount();

        mint(&env, &token_address, &customer, amount);
        let id = client.create_escrow(&merchant, &customer, &amount, &asset_code);

        // Cannot complete before funding.
        assert!(client.try_complete_escrow(&owner, &id).is_err());

        // Only participants may dispute.
        assert!(client
            .try_dispute_escrow(&outsider, &id, &String::from_str(&env, "x"))
            .is_err());

        client.fund_escrow(&customer, &id);

        // Cannot fund twice — no double-spend of the customer's balance.
        assert!(
            client.try_fund_escrow(&customer, &id).is_err(),
            "funding an already-funded escrow must fail"
        );

        // A different address cannot fund someone else's escrow.
        let other = Address::generate(&env);
        mint(&env, &token_address, &other, amount);
        assert!(client.try_fund_escrow(&other, &id).is_err());
    }
}
