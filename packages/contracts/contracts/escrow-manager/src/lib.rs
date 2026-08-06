//! EPay Escrow Manager — Soroban Smart Contract
//! Manages milestone-based escrow payments with dispute resolution on Stellar.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

const OWNER_KEY: Symbol = Symbol::short("owner");
const NEXT_ID_KEY: Symbol = Symbol::short("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum EscrowStatus { Created, Funded, InProgress, MilestoneReleased, Completed, Disputed, Resolved, Cancelled, Refunded }

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MilestoneStatus { Pending, InProgress, Completed, Released }

#[contracttype]
#[derive(Clone)]
pub struct MilestoneData {
    pub index: u32,
    pub description: String,
    pub amount: i128,
    pub status: MilestoneStatus,
    pub completed_at: Option<u64>,
    pub released_at: Option<u64>,
}

#[contracttype]
#[derive(Clone)]
pub struct EscrowData {
    pub escrow_id: u64,
    pub merchant: Address,
    pub customer: Address,
    pub total_amount: i128,
    pub asset_code: String,
    pub status: EscrowStatus,
    pub milestone_count: u32,
    pub current_milestone: u32,
    pub dispute_reason: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contract]
pub struct EscrowManager;

#[contractimpl]
impl EscrowManager {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) { panic!("Already initialized"); }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    pub fn create_escrow(
        env: Env, merchant: Address, customer: Address,
        total_amount: i128, asset_code: String,
    ) -> u64 {
        let escrow_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(escrow_id + 1));
        let now = env.ledger().timestamp();

        let escrow = EscrowData {
            escrow_id, merchant: merchant.clone(), customer: customer.clone(),
            total_amount, asset_code, status: EscrowStatus::Created,
            milestone_count: 0, current_milestone: 0,
            dispute_reason: None, created_at: now, updated_at: now,
        };

        env.storage().persistent().set(&escrow_id, &escrow);
        env.events().publish((Symbol::short("escrow_created"),), (escrow_id, merchant, customer, total_amount));
        escrow_id
    }

    pub fn fund_escrow(env: Env, escrow_id: u64) {
        let mut escrow: EscrowData = env.storage().persistent().get(&escrow_id).unwrap_or_else(|| panic!("Escrow not found"));
        if escrow.status != EscrowStatus::Created { panic!("Escrow not in created state"); }
        escrow.status = EscrowStatus::Funded;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);
        env.events().publish((Symbol::short("escrow_funded"),), (escrow_id,));
    }

    pub fn complete_escrow(env: Env, escrow_id: u64) {
        let mut escrow: EscrowData = env.storage().persistent().get(&escrow_id).unwrap_or_else(|| panic!("Escrow not found"));
        if escrow.status != EscrowStatus::Funded { panic!("Escrow not funded"); }
        escrow.status = EscrowStatus::Completed;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);
        env.events().publish((Symbol::short("escrow_completed"),), (escrow_id,));
    }

    pub fn dispute_escrow(env: Env, disputer: Address, escrow_id: u64, reason: String) {
        let mut escrow: EscrowData = env.storage().persistent().get(&escrow_id).unwrap_or_else(|| panic!("Escrow not found"));
        if escrow.customer != disputer && escrow.merchant != disputer { panic!("Only participants can dispute"); }
        escrow.status = EscrowStatus::Disputed;
        escrow.dispute_reason = Some(reason);
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);
        env.events().publish((Symbol::short("escrow_disputed"),), (escrow_id,));
    }

    pub fn resolve_dispute(env: Env, admin: Address, escrow_id: u64) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if admin != owner { panic!("Only owner can resolve disputes"); }
        let mut escrow: EscrowData = env.storage().persistent().get(&escrow_id).unwrap_or_else(|| panic!("Escrow not found"));
        if escrow.status != EscrowStatus::Disputed { panic!("Escrow not disputed"); }
        escrow.status = EscrowStatus::Resolved;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);
        env.events().publish((Symbol::short("escrow_resolved"),), (escrow_id,));
    }

    pub fn cancel_escrow(env: Env, escrow_id: u64) {
        let mut escrow: EscrowData = env.storage().persistent().get(&escrow_id).unwrap_or_else(|| panic!("Escrow not found"));
        escrow.status = EscrowStatus::Cancelled;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);
        env.events().publish((Symbol::short("escrow_cancelled"),), (escrow_id,));
    }

    pub fn refund_escrow(env: Env, escrow_id: u64) {
        let mut escrow: EscrowData = env.storage().persistent().get(&escrow_id).unwrap_or_else(|| panic!("Escrow not found"));
        if escrow.status != EscrowStatus::Cancelled && escrow.status != EscrowStatus::Disputed { panic!("Cannot refund"); }
        escrow.status = EscrowStatus::Refunded;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);
        env.events().publish((Symbol::short("escrow_refunded"),), (escrow_id,));
    }

    pub fn get_escrow(env: Env, escrow_id: u64) -> Option<EscrowData> {
        env.storage().persistent().get(&escrow_id)
    }

    pub fn escrow_exists(env: Env, escrow_id: u64) -> bool {
        env.storage().persistent().has(&escrow_id)
    }
}

#[cfg(test)]
mod test;
