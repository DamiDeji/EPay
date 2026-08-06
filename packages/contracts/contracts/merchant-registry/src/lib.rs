//! EPay Merchant Registry — Soroban Smart Contract
//! Manages merchant registration, verification, and lifecycle on Stellar.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const NEXT_ID_KEY: Symbol = symbol_short!("next_id");

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
        env.storage()
            .instance()
            .set(&symbol_short!("verifier"), &true);
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
        let addr_key = symbol_short!("addr");
        let addr_key2 = symbol_short!("addr");
        if env.storage().persistent().has(&(addr_key, owner.clone())) {
            panic!("Address already registered");
        }
        let merchant_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage()
            .instance()
            .set(&NEXT_ID_KEY, &(merchant_id + 1));
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
        env.storage()
            .persistent()
            .set(&(addr_key2, owner.clone()), &merchant_id);
        env.events()
            .publish((Symbol::new(&env, "merchant_reg"),), (merchant_id,));
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
            panic!("Merchant not pending");
        }
        merchant.status = MerchantStatus::Active;
        merchant.verification_level = VerificationLevel::Verified;
        merchant.is_active = true;
        merchant.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&merchant_id, &merchant);
        env.events()
            .publish((Symbol::new(&env, "merchant_verified"),), (merchant_id,));
    }

    pub fn suspend_merchant(env: Env, admin: Address, merchant_id: u64) {
        Self::require_verifier(&env, &admin);
        let mut merchant: MerchantData = env
            .storage()
            .persistent()
            .get(&merchant_id)
            .unwrap_or_else(|| panic!("Merchant not found"));
        if merchant.status != MerchantStatus::Active {
            panic!("Can only suspend active");
        }
        merchant.status = MerchantStatus::Suspended;
        merchant.is_active = false;
        merchant.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&merchant_id, &merchant);
        env.events()
            .publish((Symbol::new(&env, "merchant_suspended"),), (merchant_id,));
    }

    pub fn reactivate_merchant(env: Env, admin: Address, merchant_id: u64) {
        Self::require_verifier(&env, &admin);
        let mut merchant: MerchantData = env
            .storage()
            .persistent()
            .get(&merchant_id)
            .unwrap_or_else(|| panic!("Merchant not found"));
        if merchant.status != MerchantStatus::Suspended {
            panic!("Not suspended");
        }
        merchant.status = MerchantStatus::Active;
        merchant.is_active = true;
        merchant.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&merchant_id, &merchant);
        env.events()
            .publish((Symbol::new(&env, "merchant_react"),), (merchant_id,));
    }

    pub fn get_merchant(env: Env, merchant_id: u64) -> Option<MerchantData> {
        env.storage().persistent().get(&merchant_id)
    }

    pub fn get_merchant_by_address(env: Env, address: Address) -> Option<MerchantData> {
        let addr_key = symbol_short!("addr");
        let id: Option<u64> = env.storage().persistent().get(&(addr_key, address));
        id.and_then(|i| env.storage().persistent().get(&i))
    }

    pub fn is_merchant(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .has(&(symbol_short!("addr"), address))
    }

    pub fn is_merchant_active(env: Env, address: Address) -> bool {
        Self::get_merchant_by_address(env, address)
            .map(|m| m.is_active)
            .unwrap_or(false)
    }

    fn require_verifier(env: &Env, addr: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *addr != owner {
            let has: bool = env
                .storage()
                .persistent()
                .get(&(symbol_short!("verifiers"), addr.clone()))
                .unwrap_or(false);
            if !has {
                panic!("Not authorized");
            }
        }
    }
}

#[cfg(test)]
mod test;
