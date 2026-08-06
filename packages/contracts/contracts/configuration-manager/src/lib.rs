#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

const OWNER_KEY: Symbol = symbol_short!("owner");

#[contracttype]
#[derive(Clone)]
pub struct PlatformConfig {
    pub platform_fee_bps: u32,
    pub min_payment_amount: i128,
    pub max_payment_amount: i128,
    pub payment_expiry_seconds: u64,
    pub refund_window_days: u32,
    pub max_milestones: u32,
    pub settlement_interval_days: u32,
    pub maintenance_mode: bool,
    pub updated_at: u64,
}

#[contract]
pub struct ConfigurationManager;

#[contractimpl]
impl ConfigurationManager {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        let config = PlatformConfig {
            platform_fee_bps: 50,
            min_payment_amount: 1_000_000,
            max_payment_amount: 100_000_000_000_000,
            payment_expiry_seconds: 3600,
            refund_window_days: 90,
            max_milestones: 20,
            settlement_interval_days: 7,
            maintenance_mode: false,
            updated_at: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&symbol_short!("config"), &config);
    }

    pub fn get_config(env: Env) -> PlatformConfig {
        env.storage()
            .instance()
            .get(&symbol_short!("config"))
            .unwrap()
    }

    pub fn update_config(env: Env, admin: Address, new_config: PlatformConfig) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if admin != owner {
            panic!("Only owner can update config");
        }
        let mut config = new_config;
        config.updated_at = env.ledger().timestamp();
        env.storage()
            .instance()
            .set(&symbol_short!("config"), &config);
        env.events()
            .publish((Symbol::new(&env, "config_updated"),), ());
    }

    pub fn is_maintenance_mode(env: Env) -> bool {
        let config: PlatformConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("config"))
            .unwrap();
        config.maintenance_mode
    }
}

#[cfg(test)]
mod test;
