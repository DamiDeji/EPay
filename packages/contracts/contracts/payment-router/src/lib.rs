//! EPay Payment Router — Soroban Smart Contract
//! Routes and processes payments on Stellar.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const CONFIG_KEY: Symbol = symbol_short!("config");
const FEE_KEY: Symbol = symbol_short!("fee_mgr");
const PAUSE_KEY: Symbol = symbol_short!("pause");
const NEXT_ID_KEY: Symbol = symbol_short!("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PaymentStatus {
    Pending,
    Processing,
    Confirmed,
    Completed,
    Failed,
    Refunded,
    PartiallyRefunded,
    Cancelled,
    Expired,
}

#[contracttype]
#[derive(Clone)]
pub struct PaymentData {
    pub payment_id: u64,
    pub merchant: Address,
    pub payer: Address,
    pub recipient: Address,
    pub amount: i128,
    pub asset_code: String,
    pub status: PaymentStatus,
    pub fee: i128,
    pub created_at: u64,
    pub expires_at: u64,
    pub memo: Option<String>,
    pub tx_hash: Option<String>,
}

#[contract]
pub struct PaymentRouter;

#[contractimpl]
impl PaymentRouter {
    pub fn init(
        env: Env,
        owner: Address,
        config_manager: Address,
        fee_manager: Address,
        pause_contract: Address,
    ) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&CONFIG_KEY, &config_manager);
        env.storage().instance().set(&FEE_KEY, &fee_manager);
        env.storage().instance().set(&PAUSE_KEY, &pause_contract);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_payment(
        env: Env,
        merchant: Address,
        payer: Address,
        recipient: Address,
        amount: i128,
        asset_code: String,
        memo: Option<String>,
        expires_in: Option<u64>,
    ) -> u64 {
        let payment_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage()
            .instance()
            .set(&NEXT_ID_KEY, &(payment_id + 1));
        let now = env.ledger().timestamp();
        let expiry = expires_in.unwrap_or(3600);
        let fee: i128 = (amount * 50) / 10000;
        if amount < 1_000_000 {
            panic!("Amount below minimum");
        }
        let payment = PaymentData {
            payment_id,
            merchant: merchant.clone(),
            payer: payer.clone(),
            recipient,
            amount,
            asset_code,
            status: PaymentStatus::Pending,
            fee,
            created_at: now,
            expires_at: now + expiry,
            memo,
            tx_hash: None,
        };
        env.storage().persistent().set(&payment_id, &payment);
        env.events()
            .publish((Symbol::new(&env, "payment_created"),), (payment_id,));
        payment_id
    }

    pub fn confirm_payment(env: Env, payment_id: u64, tx_hash: String) {
        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));
        if payment.status != PaymentStatus::Pending {
            panic!("Not pending");
        }
        let now = env.ledger().timestamp();
        if now >= payment.expires_at {
            payment.status = PaymentStatus::Expired;
            env.storage().persistent().set(&payment_id, &payment);
            panic!("Expired");
        }
        payment.status = PaymentStatus::Confirmed;
        payment.tx_hash = Some(tx_hash);
        env.storage().persistent().set(&payment_id, &payment);
        env.events()
            .publish((Symbol::new(&env, "payment_confirmed"),), (payment_id,));
    }

    pub fn complete_payment(env: Env, payment_id: u64) {
        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));
        if payment.status != PaymentStatus::Confirmed {
            panic!("Not confirmed");
        }
        payment.status = PaymentStatus::Completed;
        env.storage().persistent().set(&payment_id, &payment);
        env.events()
            .publish((Symbol::new(&env, "payment_completed"),), (payment_id,));
    }

    pub fn fail_payment(env: Env, payment_id: u64) {
        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));
        if payment.status != PaymentStatus::Pending && payment.status != PaymentStatus::Processing {
            panic!("Cannot fail in current state");
        }
        payment.status = PaymentStatus::Failed;
        env.storage().persistent().set(&payment_id, &payment);
        env.events()
            .publish((Symbol::new(&env, "payment_failed"),), (payment_id,));
    }

    pub fn refund_payment(env: Env, payment_id: u64) {
        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));
        if payment.status != PaymentStatus::Completed {
            panic!("Can only refund completed");
        }
        payment.status = PaymentStatus::Refunded;
        env.storage().persistent().set(&payment_id, &payment);
        env.events()
            .publish((Symbol::new(&env, "payment_refunded"),), (payment_id,));
    }

    pub fn get_payment(env: Env, payment_id: u64) -> Option<PaymentData> {
        env.storage().persistent().get(&payment_id)
    }

    pub fn payment_exists(env: Env, payment_id: u64) -> bool {
        env.storage().persistent().has(&payment_id)
    }

    pub fn get_next_id(env: Env) -> u64 {
        env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1)
    }

    pub fn get_payment_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get::<_, u64>(&NEXT_ID_KEY)
            .unwrap_or(1)
            .saturating_sub(1)
    }
}

#[cfg(test)]
mod test;
