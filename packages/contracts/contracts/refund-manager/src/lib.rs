#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

const OWNER_KEY: Symbol = Symbol::short("owner");
const NEXT_ID_KEY: Symbol = Symbol::short("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum RefundStatus { Requested, Approved, Processing, Completed, Rejected, Failed }

#[contracttype]
#[derive(Clone)]
pub struct RefundData {
    pub refund_id: u64,
    pub payment_id: u64,
    pub merchant: Address,
    pub amount: i128,
    pub original_amount: i128,
    pub asset_code: String,
    pub status: RefundStatus,
    pub reason: String,
    pub is_partial: bool,
    pub created_at: u64,
    pub processed_at: Option<u64>,
}

#[contract]
pub struct RefundManager;

#[contractimpl]
impl RefundManager {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) { panic!("Already initialized"); }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    pub fn request_refund(env: Env, merchant: Address, payment_id: u64, amount: i128, original_amount: i128, asset_code: String, reason: String) -> u64 {
        let refund_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(refund_id + 1));
        let now = env.ledger().timestamp();
        let is_partial = amount < original_amount;
        let refund = RefundData { refund_id, payment_id, merchant, amount, original_amount, asset_code, status: RefundStatus::Requested, reason, is_partial, created_at: now, processed_at: None };
        env.storage().persistent().set(&refund_id, &refund);
        env.events().publish((Symbol::short("refund_requested"),), (refund_id, payment_id, amount));
        refund_id
    }

    pub fn approve_refund(env: Env, refund_id: u64) {
        let mut refund: RefundData = env.storage().persistent().get(&refund_id).unwrap_or_else(|| panic!("Refund not found"));
        if refund.status != RefundStatus::Requested { panic!("Refund not in requested state"); }
        refund.status = RefundStatus::Approved;
        env.storage().persistent().set(&refund_id, &refund);
        env.events().publish((Symbol::short("refund_approved"),), (refund_id,));
    }

    pub fn complete_refund(env: Env, refund_id: u64) {
        let mut refund: RefundData = env.storage().persistent().get(&refund_id).unwrap_or_else(|| panic!("Refund not found"));
        if refund.status != RefundStatus::Approved { panic!("Refund not approved"); }
        refund.status = RefundStatus::Completed;
        refund.processed_at = Some(env.ledger().timestamp());
        env.storage().persistent().set(&refund_id, &refund);
        env.events().publish((Symbol::short("refund_completed"),), (refund_id,));
    }

    pub fn reject_refund(env: Env, refund_id: u64) {
        let mut refund: RefundData = env.storage().persistent().get(&refund_id).unwrap_or_else(|| panic!("Refund not found"));
        refund.status = RefundStatus::Rejected;
        refund.processed_at = Some(env.ledger().timestamp());
        env.storage().persistent().set(&refund_id, &refund);
        env.events().publish((Symbol::short("refund_rejected"),), (refund_id,));
    }

    pub fn get_refund(env: Env, refund_id: u64) -> Option<RefundData> { env.storage().persistent().get(&refund_id) }
    pub fn refund_exists(env: Env, refund_id: u64) -> bool { env.storage().persistent().has(&refund_id) }
}

#[cfg(test)]
mod test;
