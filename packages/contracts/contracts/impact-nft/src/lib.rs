//! EPay Impact NFT — Soroban Smart Contract
//! Wallet-bound reputation badges that demonstrate merchant/customer impact.
//!
//! These NFTs represent:
//! - Volume-based tier badges (Bronze, Silver, Gold, Platinum)
//! - Verification badges (Verified Merchant, Top Rated)
//! - Impact milestones (100 payments processed, etc.)
//!
//! Badges are non-transferable (SBT - Soulbound Token) and travel with the wallet.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, Vec,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const NEXT_ID_KEY: Symbol = symbol_short!("next_id");

// Badge tiers
pub const TIER_BRONZE: &str = "BRONZE";
pub const TIER_SILVER: &str = "SILVER";
pub const TIER_GOLD: &str = "GOLD";
pub const TIER_PLATINUM: &str = "PLATINUM";

// Badge types
pub const BADGE_VERIFIED_MERCHANT: &str = "VERIFIED_MERCHANT";
pub const BADGE_TOP_RATED: &str = "TOP_RATED";
pub const BADGE_HIGH_VOLUME: &str = "HIGH_VOLUME";
pub const BADGE_100_PAYMENTS: &str = "100_PAYMENTS";
pub const BADGE_1000_PAYMENTS: &str = "1000_PAYMENTS";
pub const BADGE_10000_PAYMENTS: &str = "10000_PAYMENTS";
pub const BADGE_1_YEAR_ACTIVE: &str = "1_YEAR_ACTIVE";
pub const BADGE_5_YEARS_ACTIVE: &str = "5_YEARS_ACTIVE";
pub const BADGE_EARLY_ADOPTER: &str = "EARLY_ADOPTER";

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum BadgeTier {
    Bronze,
    Silver,
    Gold,
    Platinum,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BadgeDefinition {
    pub badge_id: u64,
    pub badge_type: String,  // e.g., "VERIFIED_MERCHANT"
    pub name: String,        // e.g., "Verified Merchant"
    pub description: String, // e.g., "Merchant has been verified by EPay admin"
    pub tier: BadgeTier,
    pub icon_url: Option<String>, // URL to badge icon
    pub criteria: String,         // How to earn this badge
    pub max_supply: u64,          // Max number of this badge that can be issued (0 = unlimited)
    pub issued_count: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct IssuedBadge {
    pub badge_id: u64,
    pub definition_id: u64, // Reference to BadgeDefinition
    pub owner: Address,
    pub issued_at: u64,
    pub expires_at: Option<u64>,  // Some badges may expire
    pub metadata: Option<String>, // JSON metadata
    pub is_sbt: bool,             // Soulbound (non-transferable)
}

/// Input for `register_badge_definition`.
///
/// A `#[contractimpl]` method is limited to a small number of arguments, so the
/// definition is passed as a single contract type rather than ten separate
/// parameters (which the SDK macro rejects outright).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BadgeDefinitionInput {
    pub badge_id: u64,
    pub badge_type: String,
    pub name: String,
    pub description: String,
    pub tier: BadgeTier,
    pub icon_url: Option<String>,
    pub criteria: String,
    pub max_supply: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BadgeBalance {
    pub owner: Address,
    pub badge_id: u64,
    pub amount: u64,
    pub last_updated: u64,
}

#[contract]
pub struct ImpactNFT;

#[contractimpl]
impl ImpactNFT {
    /// Initialize the badge system.
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);

        // Register default badge definitions
        Self::register_badge_definition(
            env.clone(),
            owner.clone(),
            BadgeDefinitionInput {
                badge_id: 1u64,
                badge_type: String::from_str(&env, BADGE_VERIFIED_MERCHANT),
                name: String::from_str(&env, "Verified Merchant"),
                description: String::from_str(&env, "Merchant has been verified by EPay admin"),
                tier: BadgeTier::Silver,
                icon_url: None,
                criteria: String::from_str(&env, "Merchant must be verified by admin"),
                max_supply: 1000u64,
                is_active: true,
            },
        );

        Self::register_badge_definition(
            env.clone(),
            owner.clone(),
            BadgeDefinitionInput {
                badge_id: 2u64,
                badge_type: String::from_str(&env, BADGE_TOP_RATED),
                name: String::from_str(&env, "Top Rated Merchant"),
                description: String::from_str(&env, "Merchant has consistently high ratings"),
                tier: BadgeTier::Gold,
                icon_url: None,
                criteria: String::from_str(&env, "Must maintain 4.5+ star rating"),
                max_supply: 500u64,
                is_active: true,
            },
        );

        env.storage().instance().set(&NEXT_ID_KEY, &3u64);
    }

    /// Get the contract owner.
    pub fn get_owner(env: Env) -> Address {
        env.storage().instance().get(&OWNER_KEY).unwrap()
    }

    // ════════════════════════════════════════════════════════════════════
    // BADGE DEFINITIONS
    // ════════════════════════════════════════════════════════════════════

    /// Register a new badge definition.
    pub fn register_badge_definition(env: Env, caller: Address, input: BadgeDefinitionInput) {
        Self::require_owner(&env, &caller);

        let key = (symbol_short!("badgedef"), input.badge_id);
        if env.storage().persistent().has(&key) {
            panic!("Badge definition already registered");
        }

        let definition = BadgeDefinition {
            badge_id: input.badge_id,
            badge_type: input.badge_type,
            name: input.name,
            description: input.description,
            tier: input.tier,
            icon_url: input.icon_url,
            criteria: input.criteria,
            max_supply: input.max_supply,
            issued_count: 0,
            is_active: input.is_active,
        };

        env.storage().persistent().set(&key, &definition);
    }

    /// Get a badge definition.
    pub fn get_badge_definition(env: Env, badge_id: u64) -> Option<BadgeDefinition> {
        let key = (symbol_short!("badgedef"), badge_id);
        env.storage().persistent().get(&key)
    }

    /// Update a badge definition (owner only).
    pub fn update_badge_definition(
        env: Env,
        caller: Address,
        badge_id: u64,
        name: Option<String>,
        description: Option<String>,
        icon_url: Option<String>,
        is_active: Option<bool>,
    ) {
        Self::require_owner(&env, &caller);

        let key = (symbol_short!("badgedef"), badge_id);
        let mut definition: BadgeDefinition = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Badge definition not found"));

        if let Some(n) = name {
            definition.name = n;
        }
        if let Some(d) = description {
            definition.description = d;
        }
        if let Some(i) = icon_url {
            definition.icon_url = Some(i);
        }
        if let Some(a) = is_active {
            definition.is_active = a;
        }

        env.storage().persistent().set(&key, &definition);
    }

    // ════════════════════════════════════════════════════════════════════
    // BADGE ISSUANCE (Soulbound - non-transferable)
    // ════════════════════════════════════════════════════════════════════

    /// Issue a badge to a wallet.
    /// This creates a soulbound token (SBT) that cannot be transferred.
    /// Only the contract owner can issue badges.
    pub fn issue_badge(
        env: Env,
        caller: Address,
        owner: Address,
        badge_id: u64,
        metadata: Option<String>,
        expires_at: Option<u64>,
    ) -> u64 {
        Self::require_owner(&env, &caller);

        let definition_key = (symbol_short!("badgedef"), badge_id);
        let definition: BadgeDefinition = env
            .storage()
            .persistent()
            .get(&definition_key)
            .unwrap_or_else(|| panic!("Badge definition not found"));

        if !definition.is_active {
            panic!("Badge definition is inactive");
        }

        if definition.max_supply > 0 && definition.issued_count >= definition.max_supply {
            panic!("Badge has reached maximum supply");
        }

        // Check if owner already has this badge (prevent duplicates for SBTs)
        let balance_key = (symbol_short!("balance"), owner.clone(), badge_id);
        let existing: Option<BadgeBalance> = env.storage().persistent().get(&balance_key);
        if existing.is_some() && existing.unwrap().amount >= 1 {
            panic!("Owner already has this badge");
        }

        let badge_id_final = env.storage().instance().get(&NEXT_ID_KEY).unwrap();

        let issued_badge = IssuedBadge {
            badge_id: badge_id_final,
            definition_id: badge_id,
            owner: owner.clone(),
            issued_at: env.ledger().timestamp(),
            expires_at,
            metadata,
            is_sbt: true, // All Impact badges are soulbound
        };

        let badge_key = (symbol_short!("badge"), badge_id_final);
        env.storage().persistent().set(&badge_key, &issued_badge);

        // Update balance
        let balance = BadgeBalance {
            owner: owner.clone(),
            badge_id,
            amount: 1,
            last_updated: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&balance_key, &balance);

        // Update issued count
        if definition.max_supply > 0 {
            let mut def = definition;
            def.issued_count += 1;
            env.storage().persistent().set(&definition_key, &def);
        }

        // Increment next_id
        env.storage()
            .instance()
            .set(&NEXT_ID_KEY, &(badge_id_final + 1));

        env.events().publish(
            (Symbol::new(&env, "badge_issued"),),
            (badge_id_final, owner, badge_id),
        );

        badge_id_final
    }

    // ════════════════════════════════════════════════════════════════════
    // BADGE QUERIES
    // ════════════════════════════════════════════════════════════════════

    /// Get badges held by an address.
    pub fn get_badges(env: Env, owner: Address) -> Vec<u64> {
        let mut badges = Vec::new(&env);
        let next_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap();

        for id in 1..next_id {
            let badge_key = (symbol_short!("badge"), id);
            let stored: Option<IssuedBadge> = env.storage().persistent().get(&badge_key);
            if let Some(badge) = stored {
                if badge.owner == owner && badge.is_sbt {
                    badges.push_back(id);
                }
            }
        }

        badges
    }

    /// Get badge balance for a specific badge type.
    pub fn get_badge_balance(env: Env, owner: Address, badge_id: u64) -> u64 {
        let key = (symbol_short!("balance"), owner, badge_id);
        let stored: Option<BadgeBalance> = env.storage().persistent().get(&key);
        stored.map(|b| b.amount).unwrap_or(0)
    }

    /// Get an issued badge by ID.
    pub fn get_issued_badge(env: Env, badge_id: u64) -> Option<IssuedBadge> {
        let key = (symbol_short!("badge"), badge_id);
        env.storage().persistent().get(&key)
    }

    /// Check if an address holds a specific badge type.
    pub fn has_badge(env: Env, owner: Address, badge_type: String) -> bool {
        // Find the definition ID for this badge type
        let mut badge_id = 0u64;
        let mut found = false;

        let next_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap();

        for id in 1..next_id {
            let def_key = (symbol_short!("badgedef"), id);
            let stored: Option<BadgeDefinition> = env.storage().persistent().get(&def_key);
            if let Some(def) = stored {
                if def.badge_type == badge_type {
                    badge_id = id;
                    found = true;
                    break;
                }
            }
        }

        if !found {
            return false;
        }

        let balance = Self::get_badge_balance(env.clone(), owner, badge_id);
        balance > 0
    }

    /// Get all badge types held by an address.
    pub fn get_held_badge_types(env: Env, owner: Address) -> Vec<String> {
        let badges = Self::get_badges(env.clone(), owner);
        let mut types = Vec::new(&env);

        for badge_id in badges.iter() {
            let badge = Self::get_issued_badge(env.clone(), badge_id).unwrap();
            let def = Self::get_badge_definition(env.clone(), badge.definition_id).unwrap();
            types.push_back(def.badge_type);
        }

        types
    }

    // ════════════════════════════════════════════════════════════════════
    // BADGE BURN (Owner can revoke)
    // ════════════════════════════════════════════════════════════════════

    /// Revoke (burn) a badge from an address.
    /// Only the contract owner can revoke badges (e.g., if verification is revoked).
    pub fn revoke_badge(env: Env, caller: Address, badge_id: u64) {
        Self::require_owner(&env, &caller);

        let badge_key = (symbol_short!("badge"), badge_id);
        let badge: IssuedBadge = env
            .storage()
            .persistent()
            .get(&badge_key)
            .unwrap_or_else(|| panic!("Badge not found"));

        // Remove the badge
        env.storage().persistent().remove(&badge_key);

        // Update balance
        let balance_key = (symbol_short!("balance"), badge.owner, badge.definition_id);
        let stored_balance: Option<BadgeBalance> = env.storage().persistent().get(&balance_key);
        if let Some(mut balance) = stored_balance {
            balance.amount -= 1;
            if balance.amount == 0 {
                env.storage().persistent().remove(&balance_key);
            } else {
                env.storage().persistent().set(&balance_key, &balance);
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ════════════════════════════════════════════════════════════════════

    fn require_owner(env: &Env, caller: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *caller != owner {
            panic!("Only owner can perform this action");
        }
    }
}

#[cfg(test)]
mod test;
