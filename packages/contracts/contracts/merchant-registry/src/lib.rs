//! EPay Merchant Registry — Soroban Smart Contract
//! Manages merchant registration, verification, and lifecycle on Stellar.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Map};

const OWNER_KEY: Symbol = Symbol::short("owner");
const NEXT_ID_KEY: Symbol = Symbol::short("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MerchantStatus {
    Pending,
    Active,
    Suspended,
    Rejected,
    Inactive,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum VerificationLevel {
    None,
    Basic,
    Verified,
    Enterprise,
}

#[contracttype]
#[derive(Clone)]
pub struct MerchantData {
    pub merchant_id: u64,
    pub owner: Address,
    pub business_name: String,
    pub business_email: String,
    pub business_url: Option<String>,
    pub status: MerchantStatus,
    pub verification_level: VerificationLevel,
    pub settlement_address: Address,
    pub webhook_url: Option<String>,
    pub fee_bps: u32,
    pub created_at: u64,
    pub updated_at: u64,
    pub is_active: bool,
}

#[contracttype]
pub enum MerchantEvent {
    Registered { merchant_id: u64, owner: Address, business_name: String },
    Verified { merchant_id: u64, level: VerificationLevel },
    Suspended { merchant_id: u64, reason: String },
    Reactivated { merchant_id: u64 },
    Updated { merchant_id: u64 },
}

#[contract]
pub struct MerchantRegistry;

#[contractimpl]
impl MerchantRegistry {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
        // Owner is also a verifier
        env.storage().instance().set(&Symbol::short("verifier"), &true);
    }

    pub fn register_merchant(
        env: Env,
        owner: Address,
        business_name: String,
        business_email: String,
        settlement_address: Address,
        business_url: Option<String>,
        webhook_url: Option<String>,
    ) -> u64 {
        // Check if address already registered
        let addr_key = Symbol::short("addr");
        if env.storage().persistent().has(&(addr_key, owner.clone())) {
            panic!("Address already registered as merchant");
        }

        let merchant_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(merchant_id + 1));

        let now = env.ledger().timestamp();

        let merchant = MerchantData {
            merchant_id,
            owner: owner.clone(),
            business_name: business_name.clone(),
            business_email,
            business_url,
            status: MerchantStatus::Pending,
            verification_level: VerificationLevel::None,
            settlement_address: settlement_address.clone(),
            webhook_url,
            fee_bps: 50,
            created_at: now,
            updated_at: now,
            is_active: false,
        };

        env.storage().persistent().set(&merchant_id, &merchant);
        env.storage().persistent().set(&(addr_key, owner.clone()), &merchant_id);

        env.events().publish(
            (Symbol::short("merchant_reg"),),
            MerchantEvent::Registered {
                merchant_id,
                owner,
                business_name,
            },
        );

        merchant_id
    }

    pub fn verify_merchant(env: Env, verifier: Address, merchant_id: u64) {
        Self::require_verifier(&env, &verifier);

        let mut merchant: MerchantData = env
            .storage()
            .persistent()
            .get(&merchant_id)
            .unwrap_or_else(|| panic!("Merchant not found"));

        if merchant.status != MerchantStatus::Pending {
            panic!("Merchant not in pending state");
        }

        merchant.status = MerchantStatus::Active;
        merchant.verification_level = VerificationLevel::Verified;
        merchant.is_active = true;
        merchant.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&merchant_id, &merchant);

        env.events().publish(
            (Symbol::short("merchant_verified"),),
            MerchantEvent::Verified {
                merchant_id,
                level: VerificationLevel::Verified,
            },
        );
    }

    pub fn suspend_merchant(env: Env, admin: Address, merchant_id: u64, reason: String) {
        Self::require_verifier(&env, &admin);

        let mut merchant: MerchantData = env
            .storage()
            .persistent()
            .get(&merchant_id)
            .unwrap_or_else(|| panic!("Merchant not found"));

        if merchant.status != MerchantStatus::Active {
            panic!("Can only suspend active merchants");
        }

        merchant.status = MerchantStatus::Suspended;
        merchant.is_active = false;
        merchant.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&merchant_id, &merchant);

        env.events().publish(
            (Symbol::short("merchant_suspended"),),
            MerchantEvent::Suspended {
                merchant_id,
                reason,
            },
        );
    }

    pub fn reactivate_merchant(env: Env, admin: Address, merchant_id: u64) {
        Self::require_verifier(&env, &admin);

        let mut merchant: MerchantData = env
            .storage()
            .persistent()
            .get(&merchant_id)
            .unwrap_or_else(|| panic!("Merchant not found"));

        if merchant.status != MerchantStatus::Suspended {
            panic!("Merchant not suspended");
        }

        merchant.status = MerchantStatus::Active;
        merchant.is_active = true;
        merchant.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&merchant_id, &merchant);

        env.events().publish(
            (Symbol::short("merchant_reactivated"),),
            MerchantEvent::Reactivated { merchant_id },
        );
    }

    pub fn update_fee_bps(env: Env, merchant_addr: Address, fee_bps: u32) {
        let addr_key = Symbol::short("addr");
        let merchant_id: u64 = env
            .storage()
            .persistent()
            .get(&(addr_key, merchant_addr.clone()))
            .unwrap_or_else(|| panic!("Merchant not found"));

        let mut merchant: MerchantData = env
            .storage()
            .persistent()
            .get(&merchant_id)
            .unwrap();

        if fee_bps > 500 {
            panic!("Fee too high (max 5%)");
        }

        merchant.fee_bps = fee_bps;
        merchant.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&merchant_id, &merchant);
    }

    // ── View Functions ──────────────────────────────────────────────────────

    pub fn get_merchant(env: Env, merchant_id: u64) -> Option<MerchantData> {
        env.storage().persistent().get(&merchant_id)
    }

    pub fn get_merchant_by_address(env: Env, address: Address) -> Option<MerchantData> {
        let addr_key = Symbol::short("addr");
        let merchant_id: Option<u64> = env.storage().persistent().get(&(addr_key, address));
        merchant_id.and_then(|id| env.storage().persistent().get(&id))
    }

    pub fn is_merchant(env: Env, address: Address) -> bool {
        let addr_key = Symbol::short("addr");
        env.storage().persistent().has(&(addr_key, address))
    }

    pub fn is_merchant_active(env: Env, address: Address) -> bool {
        Self::get_merchant_by_address(env, address)
            .map(|m| m.is_active)
            .unwrap_or(false)
    }

    pub fn get_merchant_count(env: Env) -> u64 {
        let next: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        next.saturating_sub(1)
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    fn require_verifier(env: &Env, addr: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *addr != owner {
            // Check if address is in verifier set
            let verifier_key = Symbol::short("verifiers");
            let has: bool = env.storage().persistent().get(&(verifier_key, addr.clone())).unwrap_or(false);
            if !has {
                panic!("Not authorized to verify merchants");
            }
        }
    }
}

#[cfg(test)]
mod test;
