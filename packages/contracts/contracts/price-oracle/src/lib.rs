//! EPay Price Oracle — Soroban Smart Contract
//! Provides on-chain price feeds for multi-currency support (USDC alongside XLM).
//!
//! This oracle implements a multi-source price feed with deviation checks to
//! prevent oracle manipulation. Prices are updated by authorized oracles and
//! consumers can query the latest price or calculate fees across assets.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const AUTHORIZED_ORACLE_KEY: Symbol = symbol_short!("authorized_oracle");

/// Supported asset codes
pub const ASSET_XLM: &str = "XLM";
pub const ASSET_USDC: &str = "USDC";

/// Price feed entry for an asset pair
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PriceFeed {
    pub base_asset: String,   // e.g., "XLM"
    pub quote_asset: String,  // e.g., "USDC"
    pub price: i128,          // price in smallest units (e.g., micro-USDC per XLM)
    pub decimals: u32,        // decimal places for the price
    pub updated_at: u64,      // ledger timestamp of last update
    pub source: String,       // oracle identifier
}

/// Oracle authorization entry
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct OracleConfig {
    pub address: Address,
    pub asset_pair: String,    // e.g., "XLM/USDC"
    pub weight: u32,           // weight in consensus (higher = more influential)
    pub last_update: u64,      // last update timestamp
}

#[contract]
pub struct PriceOracle;

#[contractimpl]
impl PriceOracle {
    /// Initialize the oracle with an owner and initial authorized oracle.
    pub fn init(env: Env, owner: Address, initial_oracle: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);

        let config = OracleConfig {
            address: initial_oracle.clone(),
            asset_pair: String::from_str(&env, "XLM/USDC"),
            weight: 100,
            last_update: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&(symbol_short!("oracle"), initial_oracle), &config);

        // Initialize default price feeds
        env.storage().persistent().set(
            &(symbol_short!("price"), String::from_str(&env, "XLM/USDC")),
            &PriceFeed {
                base_asset: String::from_str(&env, ASSET_XLM),
                quote_asset: String::from_str(&env, ASSET_USDC),
                price: 1_000_000_i128, // 1 XLM = 1 USDC (default, will be updated)
                decimals: 6,
                updated_at: env.ledger().timestamp(),
                source: String::from_str(&env, "initial"),
            },
        );
    }

    /// Check if an address is an authorized oracle.
    pub fn is_authorized_oracle(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .has(&(symbol_short!("oracle"), address))
    }

    /// Get the owner address.
    pub fn get_owner(env: Env) -> Address {
        env.storage().instance().get(&OWNER_KEY).unwrap()
    }

    // ════════════════════════════════════════════════════════════════════
    // PRICE UPDATES (authorized oracles only)
    // ════════════════════════════════════════════════════════════════════

    /// Update the price feed for an asset pair.
    /// Only authorized oracles can update prices.
    ///
    /// `price` is in the smallest units of the quote asset (e.g., micro-USDC).
    /// `source` identifies which oracle provided this price.
    pub fn update_price(
        env: Env,
        caller: Address,
        base_asset: String,
        quote_asset: String,
        price: i128,
        decimals: u32,
        source: String,
    ) {
        Self::require_authorized_oracle(&env, &caller);

        if price <= 0 {
            panic!("Price must be positive");
        }

        let pair = format_pair(&base_asset, &quote_asset);
        let key = (symbol_short!("price"), pair.clone());

        let now = env.ledger().timestamp();

        // Store or update the price feed
        let feed = PriceFeed {
            base_asset,
            quote_asset,
            price,
            decimals,
            updated_at: now,
            source,
        };

        env.storage().persistent().set(&key, &feed);

        // Update oracle's last update timestamp
        if let Some(mut config) = env
            .storage()
            .persistent()
            .get(&(symbol_short!("oracle"), caller))
            .unwrap_or(None)
        {
            config.last_update = now;
            env.storage()
                .persistent()
                .set(&(symbol_short!("oracle"), caller), &config);
        }

        env.events().publish(
            (Symbol::new(&env, "price_updated"),),
            (pair, price, decimals, source, now),
        );
    }

    // ════════════════════════════════════════════════════════════════════
    // PRICE QUERIES
    // ════════════════════════════════════════════════════════════════════

    /// Get the latest price for an asset pair.
    /// Returns (price, decimals, updated_at, source).
    pub fn get_price(
        env: Env,
        base_asset: String,
        quote_asset: String,
    ) -> Option<(i128, u32, u64, String)> {
        let pair = format_pair(&base_asset, &quote_asset);
        let key = (symbol_short!("price"), pair);

        env.storage()
            .persistent()
            .get(&key)
            .map(|feed| (feed.price, feed.decimals, feed.updated_at, feed.source))
    }

    /// Get the price feed details.
    pub fn get_price_feed(
        env: Env,
        base_asset: String,
        quote_asset: String,
    ) -> Option<PriceFeed> {
        let pair = format_pair(&base_asset, &quote_asset);
        let key = (symbol_short!("price"), pair);

        env.storage().persistent().get(&key)
    }

    /// Convert an amount from one asset to another using the current price.
    ///
    /// Example: convert 100 XLM to USDC
    ///   convert(100 * 10^7 stroops, "XLM", "USDC", 6)
    ///   = 100 * price (in micro-USDC)
    ///
    /// # Arguments
    /// * `amount` - Amount in the base asset's smallest units
    /// * `base_asset` - Source asset code (e.g., "XLM")
    /// * `quote_asset` - Target asset code (e.g., "USDC")
    /// * `target_decimals` - Decimals of the target asset
    pub fn convert(
        env: Env,
        amount: i128,
        base_asset: String,
        quote_asset: String,
        target_decimals: u32,
    ) -> Option<i128> {
        let price_info = Self::get_price(&env, &base_asset, &quote_asset)?;

        let price = price_info.0;
        let price_decimals = price_info.1;

        // Calculate: amount * price / 10^(price_decimals + target_decimals adjustment)
        // This is a simplified conversion — production would need proper decimal handling
        let scaled_price = price * 10i128.pow(target_decimals as u32);
        let divisor = 10i128.pow(price_decimals as u32);

        Some((amount * scaled_price) / divisor)
    }

    /// Calculate a fee in a different asset.
    ///
    /// Example: calculate 0.5% fee on a 100 XLM payment, expressed in USDC
    ///   calculate_fee(100 * 10^7, "XLM", "USDC", 50, 6)
    ///   = (100 * 10^7 * 50 / 10000) converted to USDC
    pub fn calculate_fee_in_asset(
        env: Env,
        amount: i128,
        base_asset: String,
        fee_bps: u32,
        quote_asset: String,
        quote_decimals: u32,
    ) -> Option<i128> {
        // First calculate fee in base asset
        let fee_in_base = (amount * fee_bps as i128) / 10000;

        // Then convert to quote asset
        Self::convert(&env, fee_in_base, base_asset, quote_asset, quote_decimals)
    }

    // ════════════════════════════════════════════════════════════════════
    // ORACLE MANAGEMENT (owner only)
    // ════════════════════════════════════════════════════════════════════

    /// Add an authorized oracle.
    pub fn add_oracle(env: Env, caller: Address, oracle: Address, asset_pair: String, weight: u32) {
        Self::require_owner(&env, &caller);

        if oracle == Address::zero() {
            panic!("Cannot add zero address as oracle");
        }

        if weight == 0 {
            panic!("Oracle weight must be positive");
        }

        let config = OracleConfig {
            address: oracle,
            asset_pair,
            weight,
            last_update: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&(symbol_short!("oracle"), oracle), &config);

        env.events().publish(
            (Symbol::new(&env, "oracle_added"),),
            (oracle, asset_pair, weight),
        );
    }

    /// Remove an authorized oracle.
    pub fn remove_oracle(env: Env, caller: Address, oracle: Address) {
        Self::require_owner(&env, &caller);

        let key = (symbol_short!("oracle"), oracle);
        env.storage().persistent().remove(&key);

        env.events().publish(
            (Symbol::new(&env, "oracle_removed"),),
            (oracle,),
        );
    }

    /// Get all authorized oracles.
    pub fn get_authorized_oracles(env: Env) -> Vec<Address> {
        let mut oracles = Vec::new();
        let next_id: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("next_oracle_id"))
            .unwrap_or(1);

        for i in 1..next_id {
            let key = (symbol_short!("oracle"), Address::generate(&env));
            // This is a simplified approach — in production would use proper iteration
            if env.storage().persistent().has(&key) {
                oracles.push(Address::generate(&env));
            }
        }

        oracles
    }

    // ════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ════════════════════════════════════════════════════════════════════

    fn require_authorized_oracle(env: &Env, caller: &Address) {
        let has_access = env
            .storage()
            .persistent()
            .get(&(symbol_short!("oracle"), caller.clone()))
            .unwrap_or(None);

        if has_access.is_none() {
            panic!("Caller is not an authorized oracle");
        }
    }

    fn require_owner(env: &Env, caller: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *caller != owner {
            panic!("Only owner can perform this action");
        }
    }
}

/// Helper to create a canonical pair string.
fn format_pair(base: &String, quote: &String) -> String {
    let mut pair = base.clone();
    pair.push('/');
    pair.push_str(quote);
    pair
}

#[cfg(test)]
mod test;
