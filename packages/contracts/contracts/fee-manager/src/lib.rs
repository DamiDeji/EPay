#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

const OWNER_KEY: Symbol = symbol_short!("owner");

#[contracttype]
#[derive(Clone)]
pub struct FeeConfig {
    pub default_fee_bps: u32,
    pub min_fee_bps: u32,
    pub max_fee_bps: u32,
    pub treasury_fee_bps: u32,
}

#[contract]
pub struct FeeManager;

#[contractimpl]
impl FeeManager {
    pub fn init(env: Env, owner: Address, default_fee_bps: u32) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        if default_fee_bps < 10 || default_fee_bps > 500 {
            panic!("Fee outside allowed bounds");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        let config = FeeConfig {
            default_fee_bps,
            min_fee_bps: 10,
            max_fee_bps: 500,
            treasury_fee_bps: 50,
        };
        env.storage()
            .instance()
            .set(&symbol_short!("config"), &config);
    }

    pub fn set_default_fee(env: Env, caller: Address, fee_bps: u32) {
        caller.require_auth();
        Self::require_owner(&env, &caller);
        let mut config: FeeConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("config"))
            .unwrap();
        Self::assert_valid_fee(&config, fee_bps);
        config.default_fee_bps = fee_bps;
        env.storage()
            .instance()
            .set(&symbol_short!("config"), &config);
    }

    pub fn set_merchant_fee(env: Env, caller: Address, merchant: Address, fee_bps: u32) {
        caller.require_auth();
        Self::require_owner(&env, &caller);
        let config: FeeConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("config"))
            .unwrap();
        Self::assert_valid_fee(&config, fee_bps);
        env.storage()
            .persistent()
            .set(&(symbol_short!("merch_fee"), merchant), &fee_bps);
    }

    pub fn calculate_fee(env: Env, amount: i128, merchant: Option<Address>) -> i128 {
        let fee_bps = if let Some(m) = merchant {
            env.storage()
                .persistent()
                .get(&(symbol_short!("merch_fee"), m))
                .unwrap_or_else(|| {
                    let config: FeeConfig = env
                        .storage()
                        .instance()
                        .get(&symbol_short!("config"))
                        .unwrap();
                    config.default_fee_bps
                })
        } else {
            let config: FeeConfig = env
                .storage()
                .instance()
                .get(&symbol_short!("config"))
                .unwrap();
            config.default_fee_bps
        };
        // Checked arithmetic: panics instead of silently wrapping on i128 overflow
        // (release builds would otherwise wrap and produce an incorrect fee).
        (amount.checked_mul(fee_bps as i128))
            .and_then(|v| v.checked_div(10000))
            .expect("Fee calculation overflow")
    }

    pub fn get_config(env: Env) -> FeeConfig {
        env.storage()
            .instance()
            .get(&symbol_short!("config"))
            .unwrap()
    }

    fn assert_valid_fee(config: &FeeConfig, fee_bps: u32) {
        if fee_bps < config.min_fee_bps || fee_bps > config.max_fee_bps {
            panic!("Fee outside allowed bounds");
        }
    }

    fn require_owner(env: &Env, caller: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *caller != owner {
            panic!("Only owner can perform this action");
        }
    }
}

#[cfg(test)]
mod test;
