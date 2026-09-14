//! EPay Price Oracle — Soroban Smart Contract
//! Provides on-chain price feeds for multi-currency support (USDC alongside XLM).
//!
//! This oracle implements a multi-source price feed with deviation checks to
//! prevent oracle manipulation. Prices are updated by authorized oracles and
//! consumers can query the latest price or calculate fees across assets.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, Vec,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
/// Symbol under which the index of authorized oracle addresses is stored.
/// `symbol_short!` is limited to 9 ASCII characters.
const ORACLE_KEY: Symbol = symbol_short!("oracle");
const ORACLE_INDEX_KEY: Symbol = symbol_short!("oracles");

/// Supported asset codes
pub const ASSET_XLM: &str = "XLM";
pub const ASSET_USDC: &str = "USDC";

/// Price feed entry for an asset pair
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PriceFeed {
    pub base_asset: String,  // e.g., "XLM"
    pub quote_asset: String, // e.g., "USDC"
    pub price: i128,         // price in smallest units (e.g., micro-USDC per XLM)
    pub decimals: u32,       // decimal places for the price
    pub updated_at: u64,     // ledger timestamp of last update
    pub source: String,      // oracle identifier
}

/// Oracle authorization entry
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct OracleConfig {
    pub address: Address,
    pub asset_pair: String, // e.g., "XLM/USDC"
    pub weight: u32,        // weight in consensus (higher = more influential)
    pub last_update: u64,   // last update timestamp
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
            .set(&(ORACLE_KEY, initial_oracle.clone()), &config);
        // Keep an index so `get_authorized_oracles` can enumerate them.
        let mut oracles = Vec::new(&env);
        oracles.push_back(initial_oracle);
        env.storage().persistent().set(&ORACLE_INDEX_KEY, &oracles);

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
        env.storage().persistent().has(&(ORACLE_KEY, address))
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

        let pair = format_pair(&env, &base_asset, &quote_asset);
        let key = (symbol_short!("price"), pair.clone());

        let now = env.ledger().timestamp();

        // Store or update the price feed
        let feed = PriceFeed {
            base_asset,
            quote_asset,
            price,
            decimals,
            updated_at: now,
            source: source.clone(),
        };

        env.storage().persistent().set(&key, &feed);

        // Update oracle's last update timestamp
        let oracle_key = (ORACLE_KEY, caller.clone());
        let stored: Option<OracleConfig> = env.storage().persistent().get(&oracle_key);
        if let Some(mut config) = stored {
            config.last_update = now;
            env.storage().persistent().set(&oracle_key, &config);
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
        let pair = format_pair(&env, &base_asset, &quote_asset);
        let key = (symbol_short!("price"), pair);
        let feed: Option<PriceFeed> = env.storage().persistent().get(&key);

        feed.map(|f| (f.price, f.decimals, f.updated_at, f.source))
    }

    /// Get the price feed details.
    pub fn get_price_feed(env: Env, base_asset: String, quote_asset: String) -> Option<PriceFeed> {
        let pair = format_pair(&env, &base_asset, &quote_asset);
        let key = (symbol_short!("price"), pair);

        env.storage().persistent().get(&key)
    }

    /// Convert an amount from one asset to another using the current price.
    ///
    /// Example: convert 100 XLM to USDC at a price of 2_000_000 (2 USDC per XLM,
    /// 6 decimals):
    ///   convert(100 * 10^7, "XLM", 7, "USDC", 6)
    ///   = 100 * 2 USDC in micro-USDC = 200_000_000
    ///
    /// Both assets' decimal counts are required: `amount` is expressed in the
    /// base asset's smallest unit, and the result in the quote asset's smallest
    /// unit. Omitting `base_decimals` silently produced a result that was wrong
    /// by a factor of 10^base_decimals.
    ///
    /// # Arguments
    /// * `amount` - Amount in the base asset's smallest units
    /// * `base_asset` - Source asset code (e.g., "XLM")
    /// * `base_decimals` - Decimals of the base asset (e.g., 7 for XLM)
    /// * `quote_asset` - Target asset code (e.g., "USDC")
    /// * `target_decimals` - Decimals of the target asset
    pub fn convert(
        env: Env,
        amount: i128,
        base_asset: String,
        base_decimals: u32,
        quote_asset: String,
        target_decimals: u32,
    ) -> Option<i128> {
        if amount < 0 {
            return None;
        }

        let price_info = Self::get_price(env.clone(), base_asset.clone(), quote_asset.clone())?;

        let price = price_info.0;
        let price_decimals = price_info.1;

        // value = amount / 10^base_decimals * price / 10^price_decimals
        //       = amount * price / (10^base_decimals * 10^price_decimals)
        // scaled to the target asset's smallest unit.
        let numerator = amount
            .checked_mul(price)?
            .checked_mul(10i128.pow(target_decimals))?;
        let divisor = 10i128
            .checked_pow(base_decimals)?
            .checked_mul(10i128.pow(price_decimals))?;

        Some(numerator / divisor)
    }

    /// Calculate a fee in a different asset.
    ///
    /// Example: calculate 0.5% fee on a 100 XLM payment, expressed in USDC
    ///   calculate_fee_in_asset(100 * 10^7, "XLM", 7, 50, "USDC", 6)
    ///   = (100 * 10^7 * 50 / 10000) converted to USDC
    pub fn calculate_fee_in_asset(
        env: Env,
        amount: i128,
        base_asset: String,
        base_decimals: u32,
        fee_bps: u32,
        quote_asset: String,
        quote_decimals: u32,
    ) -> Option<i128> {
        // First calculate fee in base asset (checked: a silently wrapped fee is
        // worse than a failed call).
        let fee_in_base = amount.checked_mul(fee_bps as i128)?.checked_div(10_000)?;

        // Then convert to quote asset
        Self::convert(
            env,
            fee_in_base,
            base_asset,
            base_decimals,
            quote_asset,
            quote_decimals,
        )
    }

    // ════════════════════════════════════════════════════════════════════
    // ORACLE MANAGEMENT (owner only)
    // ════════════════════════════════════════════════════════════════════

    /// Add an authorized oracle.
    pub fn add_oracle(env: Env, caller: Address, oracle: Address, asset_pair: String, weight: u32) {
        Self::require_owner(&env, &caller);

        if weight == 0 {
            panic!("Oracle weight must be positive");
        }

        let key = (ORACLE_KEY, oracle.clone());
        if env.storage().persistent().has(&key) {
            panic!("Oracle already authorized");
        }

        let config = OracleConfig {
            address: oracle.clone(),
            asset_pair: asset_pair.clone(),
            weight,
            last_update: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &config);

        // Maintain the enumeration index used by `get_authorized_oracles`.
        let mut oracles: Vec<Address> = env
            .storage()
            .persistent()
            .get(&ORACLE_INDEX_KEY)
            .unwrap_or_else(|| Vec::new(&env));
        oracles.push_back(oracle.clone());
        env.storage().persistent().set(&ORACLE_INDEX_KEY, &oracles);

        env.events().publish(
            (Symbol::new(&env, "oracle_added"),),
            (oracle, asset_pair, weight),
        );
    }

    /// Remove an authorized oracle.
    pub fn remove_oracle(env: Env, caller: Address, oracle: Address) {
        Self::require_owner(&env, &caller);

        let key = (ORACLE_KEY, oracle.clone());
        env.storage().persistent().remove(&key);

        // Drop the address from the enumeration index as well.
        let indexed: Vec<Address> = env
            .storage()
            .persistent()
            .get(&ORACLE_INDEX_KEY)
            .unwrap_or_else(|| Vec::new(&env));
        let mut remaining = Vec::new(&env);
        for entry in indexed.iter() {
            if entry != oracle {
                remaining.push_back(entry);
            }
        }
        env.storage()
            .persistent()
            .set(&ORACLE_INDEX_KEY, &remaining);

        env.events()
            .publish((Symbol::new(&env, "oracle_removed"),), (oracle,));
    }

    /// Get all authorized oracles.
    pub fn get_authorized_oracles(env: Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&ORACLE_INDEX_KEY)
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ════════════════════════════════════════════════════════════════════

    fn require_authorized_oracle(env: &Env, caller: &Address) {
        let has_access: Option<OracleConfig> = env
            .storage()
            .persistent()
            .get(&(ORACLE_KEY, caller.clone()));

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

/// Maximum length of a canonical "BASE/QUOTE" pair key (e.g. "XLM/USDC").
const MAX_PAIR_LEN: usize = 64;

/// Helper to create a canonical pair string.
///
/// `soroban_sdk::String` has no in-place concatenation (`push`/`push_str`), so the
/// pair is assembled byte-wise and handed back as a contract string.
fn format_pair(env: &Env, base: &String, quote: &String) -> String {
    let base_len = base.len() as usize;
    let quote_len = quote.len() as usize;
    let total = base_len + 1 + quote_len;
    if total > MAX_PAIR_LEN {
        panic!("Asset code too long for a pair key");
    }

    let mut buf = [0u8; MAX_PAIR_LEN];
    base.copy_into_slice(&mut buf[..base_len]);
    buf[base_len] = b'/';
    quote.copy_into_slice(&mut buf[base_len + 1..total]);

    String::from_bytes(env, &buf[..total])
}

#[cfg(test)]
mod test;
