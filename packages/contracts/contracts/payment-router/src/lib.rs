//! EPay Payment Router — Soroban Smart Contract
//! Routes and processes payments on Stellar with real token transfers.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const CONFIG_KEY: Symbol = symbol_short!("config");
const FEE_KEY: Symbol = symbol_short!("fee_mgr");
const PAUSE_KEY: Symbol = symbol_short!("pause");
const TOKEN_KEY: Symbol = symbol_short!("token");
const NEXT_ID_KEY: Symbol = symbol_short!("next_id");

/// Minimum payment amount in stroops (0.1 XLM = 1,000,000 stroops)
const MIN_PAYMENT_AMOUNT: i128 = 1_000_000;

/// Default payment expiry in ledger seconds (1 hour)
const DEFAULT_EXPIRY_SECONDS: u64 = 3600;

/// Default fee in basis points (50 = 0.5%)
const DEFAULT_FEE_BPS: i128 = 50;

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

/// Internal helper to get the token client for the stored token address.
fn get_token_client(env: &Env) -> token::Client {
    let token_address: Address = env
        .storage()
        .instance()
        .get(&TOKEN_KEY)
        .expect("Token address not initialized");
    token::Client::new(env, &token_address)
}

#[contractimpl]
impl PaymentRouter {
    /// Initialize the payment router with owner, external contract references, and token address.
    ///
    /// `token_address` is the Soroban token contract address for the asset this router handles
    /// (e.g., the Stellar Asset Contract address for native XLM or USDC).
    pub fn init(
        env: Env,
        owner: Address,
        config_manager: Address,
        fee_manager: Address,
        pause_contract: Address,
        token_address: Address,
    ) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&CONFIG_KEY, &config_manager);
        env.storage().instance().set(&FEE_KEY, &fee_manager);
        env.storage().instance().set(&PAUSE_KEY, &pause_contract);
        env.storage().instance().set(&TOKEN_KEY, &token_address);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    /// Create a new payment record. The payer must transfer tokens to this contract's address
    /// (atomically in the same transaction or via a prior approval + transfer_from call)
    /// before the payment can be completed.
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
        let payment_id: u64 = env
            .storage()
            .instance()
            .get(&NEXT_ID_KEY)
            .unwrap_or(1);
        env.storage()
            .instance()
            .set(&NEXT_ID_KEY, &(payment_id + 1));

        let now = env.ledger().timestamp();
        let expiry = expires_in.unwrap_or(DEFAULT_EXPIRY_SECONDS);
        let fee: i128 = (amount * DEFAULT_FEE_BPS) / 10000;

        if amount < MIN_PAYMENT_AMOUNT {
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

    /// Confirm a pending payment. Only the stored merchant or the owner can confirm.
    pub fn confirm_payment(env: Env, caller: Address, payment_id: u64, tx_hash: String) {
        caller.require_auth();

        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));

        // Only the merchant or owner can confirm
        Self::require_merchant_or_owner(&env, &caller, &payment.merchant);

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

    /// Complete a confirmed payment. Transfers `amount - fee` to the recipient.
    /// The fee is retained in the contract for later treasury settlement.
    /// Only the stored merchant or the owner can complete.
    ///
    /// The contract must already hold the full payment amount (transferred by the payer
    /// in the same or a prior transaction).
    pub fn complete_payment(env: Env, caller: Address, payment_id: u64) {
        caller.require_auth();

        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));

        // Only the merchant or owner can complete
        Self::require_merchant_or_owner(&env, &caller, &payment.merchant);

        if payment.status != PaymentStatus::Confirmed {
            panic!("Not confirmed");
        }

        let net_amount = payment.amount - payment.fee;

        // CHECKS-EFFECTS-INTERACTIONS: Update state BEFORE external token transfer
        payment.status = PaymentStatus::Completed;
        env.storage().persistent().set(&payment_id, &payment);

        // Emit events before external call
        env.events()
            .publish((Symbol::new(&env, "payment_completed"),), (payment_id,));
        if payment.fee > 0 {
            env.events().publish(
                (Symbol::new(&env, "fee_collected"),),
                (payment_id, payment.fee),
            );
        }

        // INTERACTION: Transfer net amount to recipient (external call last)
        let contract_address = env.current_contract_address();
        if net_amount > 0 {
            let token_client = get_token_client(&env);
            token_client.transfer(&contract_address, &payment.recipient, &net_amount);
        }
        // Fee is retained in the contract — tracked by the fee_collected event above
    }

    /// Fail a pending or processing payment. Only the merchant or owner can fail.
    /// No tokens are moved — this is a terminal state.
    pub fn fail_payment(env: Env, caller: Address, payment_id: u64) {
        caller.require_auth();

        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));

        Self::require_merchant_or_owner(&env, &caller, &payment.merchant);

        if payment.status != PaymentStatus::Pending
            && payment.status != PaymentStatus::Processing
        {
            panic!("Cannot fail in current state");
        }

        payment.status = PaymentStatus::Failed;
        env.storage().persistent().set(&payment_id, &payment);
        env.events()
            .publish((Symbol::new(&env, "payment_failed"),), (payment_id,));
    }

    /// Refund a completed payment. Transfers the full original amount back to the payer.
    /// Only the owner (admin) can initiate refunds.
    pub fn refund_payment(env: Env, admin: Address, payment_id: u64) {
        admin.require_auth();
        Self::require_owner(&env, &admin);

        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));

        if payment.status != PaymentStatus::Completed {
            panic!("Can only refund completed");
        }

        // CHECKS-EFFECTS-INTERACTIONS: Update state BEFORE external transfer
        payment.status = PaymentStatus::Refunded;
        env.storage().persistent().set(&payment_id, &payment);

        // Emit event before external call
        env.events()
            .publish((Symbol::new(&env, "payment_refunded"),), (payment_id,));

        // INTERACTION: Transfer full amount back to payer (external call last)
        let contract_address = env.current_contract_address();
        let token_client = get_token_client(&env);
        token_client.transfer(&contract_address, &payment.payer, &payment.amount);
    }

    /// Retrieve a payment by ID.
    pub fn get_payment(env: Env, payment_id: u64) -> Option<PaymentData> {
        env.storage().persistent().get(&payment_id)
    }

    /// Check if a payment exists.
    pub fn payment_exists(env: Env, payment_id: u64) -> bool {
        env.storage().persistent().has(&payment_id)
    }

    /// Get the next available payment ID.
    pub fn get_next_id(env: Env) -> u64 {
        env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1)
    }

    /// Get the total number of payments created.
    pub fn get_payment_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get::<_, u64>(&NEXT_ID_KEY)
            .unwrap_or(1)
            .saturating_sub(1)
    }

    /// Get the stored token address.
    pub fn get_token_address(env: Env) -> Address {
        env.storage().instance().get(&TOKEN_KEY).unwrap()
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    /// Verify the caller is the contract owner.
    fn require_owner(env: &Env, caller: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *caller != owner {
            panic!("Only owner can perform this action");
        }
    }

    /// Verify the caller is either the payment's merchant or the contract owner.
    fn require_merchant_or_owner(env: &Env, caller: &Address, merchant: &Address) {
        if *caller == *merchant {
            return;
        }
        Self::require_owner(env, caller);
    }
}

#[cfg(test)]
mod test;
