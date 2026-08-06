#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const NEXT_ID_KEY: Symbol = symbol_short!("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum SettlementStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

#[contracttype]
#[derive(Clone)]
pub struct SettlementData {
    pub settlement_id: u64,
    pub merchant: Address,
    pub amount: i128,
    pub asset_code: String,
    pub fee_amount: i128,
    pub net_amount: i128,
    pub status: SettlementStatus,
    pub period_start: u64,
    pub period_end: u64,
    pub processed_at: Option<u64>,
    pub created_at: u64,
}

#[contract]
pub struct SettlementManager;

#[contractimpl]
impl SettlementManager {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    pub fn create_settlement(
        env: Env,
        merchant: Address,
        amount: i128,
        asset_code: String,
        fee_bps: u32,
        period_start: u64,
        period_end: u64,
    ) -> u64 {
        let settlement_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage()
            .instance()
            .set(&NEXT_ID_KEY, &(settlement_id + 1));
        let fee = (amount * fee_bps as i128) / 10000;
        let net = amount - fee;
        let now = env.ledger().timestamp();
        let settlement = SettlementData {
            settlement_id,
            merchant,
            amount,
            asset_code,
            fee_amount: fee,
            net_amount: net,
            status: SettlementStatus::Pending,
            period_start,
            period_end,
            processed_at: None,
            created_at: now,
        };
        env.storage().persistent().set(&settlement_id, &settlement);
        env.events()
            .publish((Symbol::new(&env, "settlement_created"),), (settlement_id,));
        settlement_id
    }

    pub fn process_settlement(env: Env, settlement_id: u64) {
        let mut s: SettlementData = env
            .storage()
            .persistent()
            .get(&settlement_id)
            .unwrap_or_else(|| panic!("Settlement not found"));
        s.status = SettlementStatus::Completed;
        s.processed_at = Some(env.ledger().timestamp());
        env.storage().persistent().set(&settlement_id, &s);
        env.events()
            .publish((Symbol::new(&env, "settlement_done"),), (settlement_id,));
    }

    pub fn get_settlement(env: Env, settlement_id: u64) -> Option<SettlementData> {
        env.storage().persistent().get(&settlement_id)
    }
}

#[cfg(test)]
mod test;
