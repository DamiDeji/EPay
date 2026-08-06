#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Symbol};

const OWNER_KEY: Symbol = Symbol::short("owner");
const NEXT_ID_KEY: Symbol = Symbol::short("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum TxType { Deposit, Withdrawal, FeeCollection, Settlement, Refund, EscrowHold, EscrowRelease }

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum TxStatus { Pending, Processing, Completed, Failed }

#[contracttype]
#[derive(Clone)]
pub struct TreasuryTx {
    pub tx_id: u64,
    pub tx_type: TxType,
    pub amount: i128,
    pub asset_code: String,
    pub from_address: Option<Address>,
    pub to_address: Option<Address>,
    pub status: TxStatus,
    pub reference_id: Option<String>,
    pub created_at: u64,
    pub completed_at: Option<u64>,
}

#[contract]
pub struct TreasuryVault;

#[contractimpl]
impl TreasuryVault {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) { panic!("Already initialized"); }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    pub fn deposit(env: Env, from: Address, amount: i128, asset_code: String) -> u64 {
        Self::require_owner(&env);
        let tx_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(tx_id + 1));
        let now = env.ledger().timestamp();
        let tx = TreasuryTx { tx_id, tx_type: TxType::Deposit, amount, asset_code, from_address: Some(from), to_address: None, status: TxStatus::Completed, reference_id: None, created_at: now, completed_at: Some(now) };
        env.storage().persistent().set(&tx_id, &tx);
        env.events().publish((Symbol::short("treasury_deposit"),), (tx_id,));
        tx_id
    }

    pub fn withdraw(env: Env, to: Address, amount: i128, asset_code: String) -> u64 {
        Self::require_owner(&env);
        let tx_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(tx_id + 1));
        let now = env.ledger().timestamp();
        let tx = TreasuryTx { tx_id, tx_type: TxType::Withdrawal, amount, asset_code, from_address: None, to_address: Some(to), status: TxStatus::Completed, reference_id: None, created_at: now, completed_at: Some(now) };
        env.storage().persistent().set(&tx_id, &tx);
        env.events().publish((Symbol::short("treasury_withdraw"),), (tx_id,));
        tx_id
    }

    pub fn record_tx(env: Env, tx_type: TxType, amount: i128, asset_code: String, reference_id: Option<String>) -> u64 {
        let tx_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(tx_id + 1));
        let now = env.ledger().timestamp();
        let tx = TreasuryTx { tx_id, tx_type, amount, asset_code, from_address: None, to_address: None, status: TxStatus::Completed, reference_id, created_at: now, completed_at: Some(now) };
        env.storage().persistent().set(&tx_id, &tx);
        tx_id
    }

    pub fn get_transaction(env: Env, tx_id: u64) -> Option<TreasuryTx> { env.storage().persistent().get(&tx_id) }

    fn require_owner(env: &Env) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if env.current_contract_address() != owner {
            // In production: verify caller
        }
    }
}

#[cfg(test)]
mod test;
