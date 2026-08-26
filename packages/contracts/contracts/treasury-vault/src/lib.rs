//! EPay Treasury Vault — Soroban Smart Contract
//! Manages protocol treasury accounting with deposit, withdrawal, and fee collection.
//! Holds XLM/Stellar assets and enforces owner-only access for withdrawals.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const TOKEN_KEY: Symbol = symbol_short!("token");
const NEXT_ID_KEY: Symbol = symbol_short!("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum TxType {
    Deposit,
    Withdrawal,
    FeeCollection,
    Settlement,
    Refund,
    EscrowHold,
    EscrowRelease,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum TxStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

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

/// Internal helper to get the token client for the stored token address.
fn get_token_client(env: &Env) -> token::Client<'_> {
    let token_address: Address = env
        .storage()
        .instance()
        .get(&TOKEN_KEY)
        .expect("Token address not initialized");
    token::Client::new(env, &token_address)
}

#[contractimpl]
impl TreasuryVault {
    /// Initialize the treasury vault.
    ///
    /// `token_address` is the Soroban token contract address for the asset this vault manages.
    pub fn init(env: Env, owner: Address, token_address: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&TOKEN_KEY, &token_address);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    /// Deposit tokens into the treasury. Pulls funds from the sender to this contract.
    /// Only the owner (admin) can initiate deposits. Both the admin and the `from`
    /// address must authorize — the admin authorizes the operation, `from` authorizes
    /// the token transfer.
    pub fn deposit(
        env: Env,
        admin: Address,
        from: Address,
        amount: i128,
        asset_code: String,
    ) -> u64 {
        admin.require_auth();
        from.require_auth();
        Self::require_owner(&env, &admin);

        let tx_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(tx_id + 1));

        let now = env.ledger().timestamp();
        let contract_address = env.current_contract_address();

        // CHECKS-EFFECTS-INTERACTIONS: Record transaction BEFORE external transfer
        let tx = TreasuryTx {
            tx_id,
            tx_type: TxType::Deposit,
            amount,
            asset_code,
            from_address: Some(from.clone()),
            to_address: Some(contract_address.clone()),
            status: TxStatus::Completed,
            reference_id: None,
            created_at: now,
            completed_at: Some(now),
        };
        env.storage().persistent().set(&tx_id, &tx);

        // Emit event before external call
        env.events()
            .publish((Symbol::new(&env, "treasury_deposit"),), (tx_id,));

        // INTERACTION: Transfer tokens from `from` to this vault contract (external call last)
        let token_client = get_token_client(&env);
        token_client.transfer(&from, &contract_address, &amount);

        tx_id
    }

    /// Withdraw tokens from the treasury to an external address.
    /// Only the owner can withdraw.
    pub fn withdraw(
        env: Env,
        admin: Address,
        to: Address,
        amount: i128,
        asset_code: String,
    ) -> u64 {
        admin.require_auth();
        Self::require_owner(&env, &admin);

        let tx_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(tx_id + 1));

        let now = env.ledger().timestamp();
        let contract_address = env.current_contract_address();

        // CHECKS-EFFECTS-INTERACTIONS: Record transaction BEFORE external transfer
        let tx = TreasuryTx {
            tx_id,
            tx_type: TxType::Withdrawal,
            amount,
            asset_code,
            from_address: Some(contract_address.clone()),
            to_address: Some(to.clone()),
            status: TxStatus::Completed,
            reference_id: None,
            created_at: now,
            completed_at: Some(now),
        };
        env.storage().persistent().set(&tx_id, &tx);

        // Emit event before external call
        env.events()
            .publish((Symbol::new(&env, "treasury_withdraw"),), (tx_id,));

        // INTERACTION: Transfer tokens from vault to destination (external call last)
        let token_client = get_token_client(&env);
        token_client.transfer(&contract_address, &to, &amount);

        tx_id
    }

    /// Record a treasury transaction for accounting without moving tokens.
    /// Used for fee collection tracking, escrow holds/releases, settlements, and refunds
    /// where the token transfer is handled by the calling contract (e.g., PaymentRouter or EscrowManager).
    ///
    /// Only the owner may record transactions. If other EPay contracts need to
    /// record on behalf of the protocol, extend this with a caller allowlist
    /// (see the contributor backlog) rather than removing the check.
    pub fn record_tx(
        env: Env,
        caller: Address,
        tx_type: TxType,
        amount: i128,
        asset_code: String,
        reference_id: Option<String>,
    ) -> u64 {
        caller.require_auth();
        Self::require_owner(&env, &caller);

        let tx_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(tx_id + 1));

        let now = env.ledger().timestamp();
        let tx = TreasuryTx {
            tx_id,
            tx_type,
            amount,
            asset_code,
            from_address: None,
            to_address: None,
            status: TxStatus::Completed,
            reference_id,
            created_at: now,
            completed_at: Some(now),
        };

        env.storage().persistent().set(&tx_id, &tx);
        env.events()
            .publish((Symbol::new(&env, "treasury_tx_recorded"),), (tx_id,));
        tx_id
    }

    /// Get a transaction by ID.
    pub fn get_transaction(env: Env, tx_id: u64) -> Option<TreasuryTx> {
        env.storage().persistent().get(&tx_id)
    }

    /// Get the stored token address.
    pub fn get_token_address(env: Env) -> Address {
        env.storage().instance().get(&TOKEN_KEY).unwrap()
    }

    /// Get the total number of transactions.
    pub fn get_tx_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get::<_, u64>(&NEXT_ID_KEY)
            .unwrap_or(1)
            .saturating_sub(1)
    }

    /// Internal: verify the caller is the contract owner.
    /// Panics if the caller does not match the stored owner.
    fn require_owner(env: &Env, caller: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *caller != owner {
            panic!("Only owner can perform this action");
        }
    }
}

#[cfg(test)]
mod test;
