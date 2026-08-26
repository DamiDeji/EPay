//! EPay Refund Manager — Soroban Smart Contract
//! Processes full and partial refunds with on-chain token transfers on Stellar.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const TOKEN_KEY: Symbol = symbol_short!("token");
const NEXT_ID_KEY: Symbol = symbol_short!("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum RefundStatus {
    Requested,
    Approved,
    Processing,
    Completed,
    Rejected,
    Failed,
}

#[contracttype]
#[derive(Clone)]
pub struct RefundData {
    pub refund_id: u64,
    pub payment_id: u64,
    pub merchant: Address,
    pub payer: Address,
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
impl RefundManager {
    /// Initialize the refund manager.
    ///
    /// `token_address` is the Soroban token contract address for the asset this manager handles.
    pub fn init(env: Env, owner: Address, token_address: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&TOKEN_KEY, &token_address);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    /// Request a refund for a payment. Records the refund request for admin approval.
    #[allow(clippy::too_many_arguments)]
    pub fn request_refund(
        env: Env,
        merchant: Address,
        payer: Address,
        payment_id: u64,
        amount: i128,
        original_amount: i128,
        asset_code: String,
        reason: String,
    ) -> u64 {
        merchant.require_auth();

        // Validate the refund amount: must be positive and never exceed the
        // original payment, otherwise an admin could be asked to approve a
        // refund larger than what was paid.
        if amount <= 0 {
            panic!("Refund amount must be positive");
        }
        if amount > original_amount {
            panic!("Refund amount exceeds original amount");
        }

        let refund_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(refund_id + 1));

        let now = env.ledger().timestamp();
        let is_partial = amount < original_amount;

        let refund = RefundData {
            refund_id,
            payment_id,
            merchant,
            payer,
            amount,
            original_amount,
            asset_code,
            status: RefundStatus::Requested,
            reason,
            is_partial,
            created_at: now,
            processed_at: None,
        };

        env.storage().persistent().set(&refund_id, &refund);
        env.events().publish(
            (Symbol::new(&env, "refund_requested"),),
            (refund_id, payment_id, amount),
        );
        refund_id
    }

    /// Approve a refund request. Only the owner (admin) can approve.
    pub fn approve_refund(env: Env, admin: Address, refund_id: u64) {
        admin.require_auth();
        Self::require_owner(&env, &admin);

        let mut refund: RefundData = env
            .storage()
            .persistent()
            .get(&refund_id)
            .unwrap_or_else(|| panic!("Refund not found"));

        if refund.status != RefundStatus::Requested {
            panic!("Refund not in requested state");
        }

        refund.status = RefundStatus::Approved;
        env.storage().persistent().set(&refund_id, &refund);
        env.events()
            .publish((Symbol::new(&env, "refund_approved"),), (refund_id,));
    }

    /// Complete an approved refund. Transfers the refund amount from the contract
    /// back to the original payer's wallet.
    ///
    /// The contract must hold sufficient tokens (e.g., from the original payment
    /// being held by the PaymentRouter or transferred by the merchant).
    pub fn complete_refund(env: Env, admin: Address, refund_id: u64) {
        admin.require_auth();
        Self::require_owner(&env, &admin);

        let mut refund: RefundData = env
            .storage()
            .persistent()
            .get(&refund_id)
            .unwrap_or_else(|| panic!("Refund not found"));

        if refund.status != RefundStatus::Approved {
            panic!("Refund not approved");
        }

        // CHECKS-EFFECTS-INTERACTIONS: Update state BEFORE external transfer
        refund.status = RefundStatus::Completed;
        refund.processed_at = Some(env.ledger().timestamp());
        env.storage().persistent().set(&refund_id, &refund);

        // Emit event before external call
        env.events()
            .publish((Symbol::new(&env, "refund_completed"),), (refund_id,));

        // INTERACTION: Transfer refund amount from contract to payer (external call last)
        let contract_address = env.current_contract_address();
        let token_client = get_token_client(&env);
        token_client.transfer(&contract_address, &refund.payer, &refund.amount);
    }

    /// Reject a refund request.
    pub fn reject_refund(env: Env, admin: Address, refund_id: u64) {
        admin.require_auth();
        Self::require_owner(&env, &admin);

        let mut refund: RefundData = env
            .storage()
            .persistent()
            .get(&refund_id)
            .unwrap_or_else(|| panic!("Refund not found"));

        refund.status = RefundStatus::Rejected;
        refund.processed_at = Some(env.ledger().timestamp());
        env.storage().persistent().set(&refund_id, &refund);
        env.events()
            .publish((Symbol::new(&env, "refund_rejected"),), (refund_id,));
    }

    /// Get refund by ID.
    pub fn get_refund(env: Env, refund_id: u64) -> Option<RefundData> {
        env.storage().persistent().get(&refund_id)
    }

    /// Check if a refund exists.
    pub fn refund_exists(env: Env, refund_id: u64) -> bool {
        env.storage().persistent().has(&refund_id)
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
