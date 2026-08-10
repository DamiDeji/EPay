//! EPay Escrow Manager — Soroban Smart Contract
//! Manages milestone-based escrow payments with dispute resolution on Stellar.
//! Holds funds in escrow and releases them when conditions are met.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const TOKEN_KEY: Symbol = symbol_short!("token");
const NEXT_ID_KEY: Symbol = symbol_short!("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum EscrowStatus {
    Created,
    Funded,
    InProgress,
    MilestoneReleased,
    Completed,
    Disputed,
    Resolved,
    Cancelled,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    InProgress,
    Completed,
    Released,
}

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
impl EscrowManager {
    /// Initialize the escrow manager.
    ///
    /// `token_address` is the Soroban token contract address for the asset this escrow handles.
    pub fn init(env: Env, owner: Address, token_address: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&TOKEN_KEY, &token_address);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    /// Create a new escrow agreement. The customer must transfer the `total_amount`
    /// to this contract's address (atomically in the same transaction or via prior approval)
    /// before `fund_escrow` can be called.
    pub fn create_escrow(
        env: Env,
        merchant: Address,
        customer: Address,
        total_amount: i128,
        asset_code: String,
    ) -> u64 {
        let escrow_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(escrow_id + 1));
        let now = env.ledger().timestamp();

        let escrow = EscrowData {
            escrow_id,
            merchant: merchant.clone(),
            customer: customer.clone(),
            total_amount,
            asset_code,
            status: EscrowStatus::Created,
            milestone_count: 0,
            current_milestone: 0,
            dispute_reason: None,
            created_at: now,
            updated_at: now,
        };

        env.storage().persistent().set(&escrow_id, &escrow);
        env.events().publish(
            (Symbol::new(&env, "escrow_created"),),
            (escrow_id, merchant, customer, total_amount),
        );
        escrow_id
    }

    /// Fund the escrow by pulling the total amount from the customer to this contract.
    /// The customer must have approved this contract to spend the tokens via
    /// `token.approve(contract_address, amount, ledger_expiry)` before calling this.
    pub fn fund_escrow(env: Env, customer: Address, escrow_id: u64) {
        customer.require_auth();

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&escrow_id)
            .unwrap_or_else(|| panic!("Escrow not found"));

        // Validate that the caller matches the escrow's recorded customer
        if customer != escrow.customer {
            panic!("Caller is not the escrow customer");
        }

        if escrow.status != EscrowStatus::Created {
            panic!("Escrow not in created state");
        }

        // CHECKS-EFFECTS-INTERACTIONS: Update state BEFORE external transfer
        escrow.status = EscrowStatus::Funded;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);

        // Emit event before external call
        env.events()
            .publish((Symbol::new(&env, "escrow_funded"),), (escrow_id,));

        // INTERACTION: Transfer funds from customer to escrow contract (external call last)
        let contract_address = env.current_contract_address();
        let token_client = get_token_client(&env);
        token_client.transfer(&customer, &contract_address, &escrow.total_amount);
    }

    /// Complete the escrow — releases the full escrowed amount to the merchant.
    /// Only the owner (admin) can call this.
    pub fn complete_escrow(env: Env, admin: Address, escrow_id: u64) {
        admin.require_auth();
        Self::require_owner(&env, &admin);

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&escrow_id)
            .unwrap_or_else(|| panic!("Escrow not found"));

        if escrow.status != EscrowStatus::Funded {
            panic!("Escrow not funded");
        }

        // CHECKS-EFFECTS-INTERACTIONS: Update state BEFORE external transfer
        escrow.status = EscrowStatus::Completed;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);

        // Emit event before external call
        env.events()
            .publish((Symbol::new(&env, "escrow_completed"),), (escrow_id,));

        // INTERACTION: Release funds to merchant (external call last)
        let contract_address = env.current_contract_address();
        let token_client = get_token_client(&env);
        token_client.transfer(&contract_address, &escrow.merchant, &escrow.total_amount);
    }

    /// File a dispute. Only the customer or merchant can dispute.
    pub fn dispute_escrow(env: Env, disputer: Address, escrow_id: u64, reason: String) {
        disputer.require_auth();

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&escrow_id)
            .unwrap_or_else(|| panic!("Escrow not found"));

        if escrow.customer != disputer && escrow.merchant != disputer {
            panic!("Only participants can dispute");
        }

        escrow.status = EscrowStatus::Disputed;
        escrow.dispute_reason = Some(reason);
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);
        env.events()
            .publish((Symbol::new(&env, "escrow_disputed"),), (escrow_id,));
    }

    /// Resolve a dispute. Only the owner can resolve disputes.
    pub fn resolve_dispute(env: Env, admin: Address, escrow_id: u64) {
        admin.require_auth();
        Self::require_owner(&env, &admin);

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&escrow_id)
            .unwrap_or_else(|| panic!("Escrow not found"));

        if escrow.status != EscrowStatus::Disputed {
            panic!("Escrow not disputed");
        }

        escrow.status = EscrowStatus::Resolved;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);
        env.events()
            .publish((Symbol::new(&env, "escrow_resolved"),), (escrow_id,));
    }

    /// Cancel an escrow. Only cancellable in Created or Disputed state.
    pub fn cancel_escrow(env: Env, caller: Address, escrow_id: u64) {
        caller.require_auth();

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&escrow_id)
            .unwrap_or_else(|| panic!("Escrow not found"));

        // Only participants or owner can cancel
        if escrow.customer != caller && escrow.merchant != caller {
            Self::require_owner(&env, &caller);
        }

        if escrow.status != EscrowStatus::Created && escrow.status != EscrowStatus::Disputed {
            panic!("Cannot cancel in current state");
        }

        escrow.status = EscrowStatus::Cancelled;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);
        env.events()
            .publish((Symbol::new(&env, "escrow_cancelled"),), (escrow_id,));
    }

    /// Refund a cancelled or disputed escrow. Returns all held funds to the customer.
    pub fn refund_escrow(env: Env, admin: Address, escrow_id: u64) {
        admin.require_auth();
        Self::require_owner(&env, &admin);

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&escrow_id)
            .unwrap_or_else(|| panic!("Escrow not found"));

        if escrow.status != EscrowStatus::Cancelled && escrow.status != EscrowStatus::Disputed {
            panic!("Cannot refund — escrow must be cancelled or disputed");
        }

        // CHECKS-EFFECTS-INTERACTIONS: Update state BEFORE external transfer
        escrow.status = EscrowStatus::Refunded;
        escrow.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&escrow_id, &escrow);

        // Emit event before external call
        env.events()
            .publish((Symbol::new(&env, "escrow_refunded"),), (escrow_id,));

        // INTERACTION: Return funds to customer (external call last)
        let contract_address = env.current_contract_address();
        let token_client = get_token_client(&env);
        token_client.transfer(&contract_address, &escrow.customer, &escrow.total_amount);
    }

    /// Get escrow by ID.
    pub fn get_escrow(env: Env, escrow_id: u64) -> Option<EscrowData> {
        env.storage().persistent().get(&escrow_id)
    }

    /// Check if an escrow exists.
    pub fn escrow_exists(env: Env, escrow_id: u64) -> bool {
        env.storage().persistent().has(&escrow_id)
    }

    /// Get the stored token address.
    pub fn get_token_address(env: Env) -> Address {
        env.storage().instance().get(&TOKEN_KEY).unwrap()
    }

    /// Internal: verify the caller is the contract owner.
    fn require_owner(env: &Env, caller: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *caller != owner {
            panic!("Only owner can perform this action");
        }
    }
}

#[cfg(test)]
mod test;
