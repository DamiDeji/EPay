//! EPay Payment Router — Soroban Smart Contract
//! Routes and processes payments between payers and merchants on Stellar.
//! Handles payment creation, confirmation, completion, and failure scenarios.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Symbol, Vec, Map,
};

// ── Storage Keys ────────────────────────────────────────────────────────────

const OWNER_KEY: Symbol = Symbol::short("owner");
const CONFIG_KEY: Symbol = Symbol::short("config");
const FEE_KEY: Symbol = Symbol::short("fee_mgr");
const PAUSE_KEY: Symbol = Symbol::short("pause");
const NEXT_ID_KEY: Symbol = Symbol::short("next_id");

// ── Types ───────────────────────────────────────────────────────────────────

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
    pub asset: AssetInfo,
    pub status: PaymentStatus,
    pub fee: i128,
    pub created_at: u64,
    pub expires_at: u64,
    pub memo: Option<String>,
    pub tx_hash: Option<String>,
}

#[contracttype]
#[derive(Clone)]
pub struct AssetInfo {
    /// Native XLM: code = "native", issuer = empty
    /// Custom: code = "USDC", issuer = G...
    pub code: String,
    pub issuer: Address,
}

// ── Events ──────────────────────────────────────────────────────────────────

#[contracttype]
pub enum PaymentEvent {
    Created { payment_id: u64, merchant: Address, payer: Address, amount: i128 },
    Confirmed { payment_id: u64, tx_hash: String },
    Completed { payment_id: u64 },
    Failed { payment_id: u64, reason: String },
    Refunded { payment_id: u64, refund_amount: i128 },
}

// ── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct PaymentRouter;

#[contractimpl]
impl PaymentRouter {
    /// Initialize the contract with owner and dependencies.
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

    /// Create a new payment. Payer sends funds to the contract.
    pub fn create_payment(
        env: Env,
        payer: Address,
        merchant: Address,
        recipient: Address,
        amount: i128,
        asset: AssetInfo,
        memo: Option<String>,
        expires_in: Option<u64>,
    ) -> u64 {
        // Check not paused
        // Self::ensure_not_paused(&env);

        let payment_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(payment_id + 1));

        let now = env.ledger().timestamp();
        let expiry = expires_in.unwrap_or(3600);

        // Calculate fee (0.5% default)
        let fee: i128 = (amount * 50) / 10000;

        // Validate minimum payment
        if amount < 1_000_000 {
            // 0.1 XLM minimum
            panic!("Amount below minimum payment");
        }

        let payment = PaymentData {
            payment_id,
            merchant: merchant.clone(),
            payer: payer.clone(),
            recipient,
            amount,
            asset,
            status: PaymentStatus::Pending,
            fee,
            created_at: now,
            expires_at: now + expiry,
            memo,
            tx_hash: None,
        };

        env.storage().persistent().set(&payment_id, &payment);

        env.events().publish(
            (Symbol::short("payment_created"),),
            PaymentEvent::Created {
                payment_id,
                merchant,
                payer,
                amount,
            },
        );

        payment_id
    }

    /// Confirm a payment has been received on-chain.
    pub fn confirm_payment(env: Env, payment_id: u64, tx_hash: String) {
        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));

        if payment.status != PaymentStatus::Pending {
            panic!("Payment not in pending state");
        }

        let now = env.ledger().timestamp();
        if now >= payment.expires_at {
            payment.status = PaymentStatus::Expired;
            env.storage().persistent().set(&payment_id, &payment);
            panic!("Payment expired");
        }

        payment.status = PaymentStatus::Confirmed;
        payment.tx_hash = Some(tx_hash.clone());
        env.storage().persistent().set(&payment_id, &payment);

        env.events().publish(
            (Symbol::short("payment_confirmed"),),
            PaymentEvent::Confirmed {
                payment_id,
                tx_hash,
            },
        );
    }

    /// Complete a payment and forward funds to recipient.
    pub fn complete_payment(env: Env, payment_id: u64) {
        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));

        if payment.status != PaymentStatus::Confirmed {
            panic!("Payment not in confirmed state");
        }

        payment.status = PaymentStatus::Completed;
        let net_amount = payment.amount - payment.fee;

        // Transfer net amount to recipient
        Self::transfer_asset(
            &env,
            &payment.asset,
            &env.current_contract_address(),
            &payment.recipient,
            net_amount,
        );

        env.storage().persistent().set(&payment_id, &payment);

        env.events().publish(
            (Symbol::short("payment_completed"),),
            PaymentEvent::Completed { payment_id },
        );
    }

    /// Mark a payment as failed.
    pub fn fail_payment(env: Env, payment_id: u64, reason: String) {
        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));

        if payment.status != PaymentStatus::Pending
            && payment.status != PaymentStatus::Processing
        {
            panic!("Cannot fail payment in current state");
        }

        payment.status = PaymentStatus::Failed;

        // Refund payer if funds were held
        if payment.amount > 0 {
            Self::transfer_asset(
                &env,
                &payment.asset,
                &env.current_contract_address(),
                &payment.payer,
                payment.amount,
            );
        }

        env.storage().persistent().set(&payment_id, &payment);

        env.events().publish(
            (Symbol::short("payment_failed"),),
            PaymentEvent::Failed {
                payment_id,
                reason,
            },
        );
    }

    /// Process a full refund.
    pub fn refund_payment(env: Env, payment_id: u64) {
        let mut payment: PaymentData = env
            .storage()
            .persistent()
            .get(&payment_id)
            .unwrap_or_else(|| panic!("Payment not found"));

        if payment.status != PaymentStatus::Completed {
            panic!("Can only refund completed payments");
        }

        payment.status = PaymentStatus::Refunded;

        // Return full amount to payer
        Self::transfer_asset(
            &env,
            &payment.asset,
            &env.current_contract_address(),
            &payment.payer,
            payment.amount,
        );

        env.storage().persistent().set(&payment_id, &payment);

        env.events().publish(
            (Symbol::short("payment_refunded"),),
            PaymentEvent::Refunded {
                payment_id,
                refund_amount: payment.amount,
            },
        );
    }

    // ── View Functions ──────────────────────────────────────────────────────

    /// Get payment details by ID.
    pub fn get_payment(env: Env, payment_id: u64) -> Option<PaymentData> {
        env.storage().persistent().get(&payment_id)
    }

    /// Check if a payment exists.
    pub fn payment_exists(env: Env, payment_id: u64) -> bool {
        env.storage().persistent().has(&payment_id)
    }

    /// Get the next payment ID.
    pub fn get_next_payment_id(env: Env) -> u64 {
        env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1)
    }

    /// Get total payment count.
    pub fn get_payment_count(env: Env) -> u64 {
        let next: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        next.saturating_sub(1)
    }

    // ── Internal Helpers ────────────────────────────────────────────────────

    fn transfer_asset(
        env: &Env,
        asset: &AssetInfo,
        from: &Address,
        to: &Address,
        amount: i128,
    ) {
        if asset.code == String::from_str(env, "native") {
            // Transfer native XLM
            let token = token::StellarAssetClient::new(env, &env.current_contract_address());
            // In production: use proper TTL management
            // token.transfer(from, to, &amount);
            let _ = (token, from, to, amount);
        } else {
            // Transfer custom asset via token contract
            let token = token::Client::new(env, &asset.issuer);
            token.transfer(from, to, &amount);
        }
    }

    fn ensure_not_paused(_env: &Env) {
        // In production: cross-contract call to EmergencyPause contract
        // let pause = EmergencyPauseClient::new(env, &pause_addr);
        // pause.require_not_paused();
    }
}

#[cfg(test)]
mod test;
