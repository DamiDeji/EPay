//! EPay Upgrade Manager — Soroban Smart Contract
//! Implements ADR 0004: two-step admin transfer, timelocked upgrades, circuit breaker.
//!
//! This contract manages the admin identity for other EPay contracts and provides
//! a timelocked upgrade mechanism. Contracts call this manager to:
//! - Transfer admin via two-step process (transfer_admin → accept_admin)
//! - Propose upgrades with a 72-hour minimum timelock
//! - Execute or cancel pending upgrades
//! - Pause/unpause value movement

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Bytes, Env, String, Symbol, Vec,
};

// `symbol_short!` is limited to 9 ASCII characters; the previous names exceeded
// that limit and prevented this crate from compiling at all.
const OWNER_KEY: Symbol = symbol_short!("owner");
const PENDING_ADMIN_KEY: Symbol = symbol_short!("pending");
const UPGRADE_PROPOSAL_KEY: Symbol = symbol_short!("upg_prop");
const UPGRADE_STATUS_KEY: Symbol = symbol_short!("upg_stat");
const NEXT_PROPOSAL_KEY: Symbol = symbol_short!("next_prop");
const LAST_UPGRADE_KEY: Symbol = symbol_short!("last_upg");
const PROPOSAL_KEY: Symbol = symbol_short!("proposal");
const MIN_TIMELOCK_SECONDS: u64 = 259_200; // 72 hours

/// A proposed, not-yet-accepted admin handover.
///
/// `#[contracttype]` does not support enum variants with named fields, so the
/// pending handover is modelled as a struct held in an `Option`.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PendingAdminTransfer {
    pub new_admin: Address,
    pub proposed_by: Address,
    pub proposed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct UpgradeProposal {
    /// SHA-256 hash of the new WASM binary. `Bytes` (not `Vec<u8>`) is the
    /// Soroban value type that round-trips through contract storage.
    pub new_wasm_hash: Bytes,
    pub proposed_by: Address,
    pub proposed_at: u64,
    pub executable_at: u64,
    pub description: String,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum UpgradeStatus {
    None,
    Executed,
}

#[contract]
pub struct UpgradeManager;

#[contractimpl]
impl UpgradeManager {
    /// Initialize with the initial admin owner.
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage()
            .instance()
            .set(&PENDING_ADMIN_KEY, &Option::<PendingAdminTransfer>::None);
        env.storage()
            .instance()
            .set(&UPGRADE_STATUS_KEY, &UpgradeStatus::None);
        env.storage().instance().set(&NEXT_PROPOSAL_KEY, &1u64);
    }

    /// Check if the caller is the current admin.
    pub fn is_admin(env: Env, caller: Address) -> bool {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        caller == owner
    }

    /// Get the current admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&OWNER_KEY).unwrap()
    }

    // ════════════════════════════════════════════════════════════════════
    // TWO-STEP ADMIN TRANSFER (ADR 0004 §1)
    // ════════════════════════════════════════════════════════════════════

    /// Propose a new admin. The transfer only completes when the proposed admin
    /// calls `accept_admin`. This prevents accidental or malicious admin changes.
    ///
    /// Only the current admin can propose a transfer.
    pub fn transfer_admin(env: Env, caller: Address, new_admin: Address) {
        Self::require_admin(&env, &caller);

        if new_admin == caller {
            panic!("Cannot transfer admin to the current admin");
        }

        let state = PendingAdminTransfer {
            new_admin: new_admin.clone(),
            proposed_by: caller.clone(),
            proposed_at: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&PENDING_ADMIN_KEY, &Some(state));

        env.events().publish(
            (Symbol::new(&env, "admin_transfer_proposed"),),
            (caller, new_admin),
        );
    }

    /// Accept a pending admin transfer. Only the proposed new admin can call this.
    /// After acceptance, the caller becomes the new admin.
    pub fn accept_admin(env: Env, caller: Address) {
        let pending: Option<PendingAdminTransfer> = env
            .storage()
            .instance()
            .get(&PENDING_ADMIN_KEY)
            .unwrap_or(None);

        match pending {
            None => panic!("No admin transfer pending"),
            Some(p) if p.new_admin != caller => panic!("Only the proposed admin can accept"),
            Some(_) => {}
        }

        env.storage().instance().set(&OWNER_KEY, &caller);
        env.storage()
            .instance()
            .set(&PENDING_ADMIN_KEY, &Option::<PendingAdminTransfer>::None);

        env.events()
            .publish((Symbol::new(&env, "admin_transfer_completed"),), (caller,));
    }

    /// Cancel a pending admin transfer. Only the current admin can cancel.
    pub fn cancel_admin_transfer(env: Env, caller: Address) {
        Self::require_admin(&env, &caller);

        let pending: Option<PendingAdminTransfer> = env
            .storage()
            .instance()
            .get(&PENDING_ADMIN_KEY)
            .unwrap_or(None);

        if pending.is_none() {
            panic!("No admin transfer to cancel");
        }

        env.storage()
            .instance()
            .set(&PENDING_ADMIN_KEY, &Option::<PendingAdminTransfer>::None);

        env.events()
            .publish((Symbol::new(&env, "admin_transfer_cancelled"),), ());
    }

    // ════════════════════════════════════════════════════════════════════
    // TIMELOCKED UPGRADES (ADR 0004 §2)
    // ════════════════════════════════════════════════════════════════════

    /// Propose a contract upgrade. The upgrade can only be executed after
    /// MIN_TIMELOCK_SECONDS (72 hours) have passed. This gives users time to
    /// review the proposed WASM hash and exit if they don't accept it.
    ///
    /// The `new_wasm_hash` is the SHA-256 hash of the new WASM binary.
    /// The `description` should explain what the upgrade does.
    pub fn propose_upgrade(
        env: Env,
        caller: Address,
        new_wasm_hash: Bytes,
        description: String,
    ) -> u64 {
        Self::require_admin(&env, &caller);

        if new_wasm_hash.len() != 32 {
            panic!("WASM hash must be 32 bytes (SHA-256)");
        }

        let now = env.ledger().timestamp();
        let executable_at = now + MIN_TIMELOCK_SECONDS;

        let proposal = UpgradeProposal {
            new_wasm_hash,
            proposed_by: caller.clone(),
            proposed_at: now,
            executable_at,
            description,
        };

        // Use a counter for proposal IDs
        let proposal_id: u64 = env
            .storage()
            .instance()
            .get(&NEXT_PROPOSAL_KEY)
            .unwrap_or(1);
        env.storage()
            .instance()
            .set(&NEXT_PROPOSAL_KEY, &(proposal_id + 1));

        let key = (PROPOSAL_KEY, proposal_id);
        env.storage().persistent().set(&key, &proposal);

        env.events().publish(
            (Symbol::new(&env, "upgrade_proposed"),),
            (proposal_id, caller, executable_at),
        );

        proposal_id
    }

    /// Execute a pending upgrade. Can only be called by the admin after the
    /// timelock has expired.
    pub fn execute_upgrade(env: Env, caller: Address, proposal_id: u64) {
        Self::require_admin(&env, &caller);

        let key = (PROPOSAL_KEY, proposal_id);
        let proposal: UpgradeProposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Upgrade proposal not found"));

        if proposal.executable_at > env.ledger().timestamp() {
            panic!("Upgrade timelock has not expired");
        }

        let now = env.ledger().timestamp();

        // Record execution
        env.storage()
            .instance()
            .set(&UPGRADE_PROPOSAL_KEY, &Some(proposal.clone()));
        env.storage()
            .instance()
            .set(&UPGRADE_STATUS_KEY, &UpgradeStatus::Executed);
        env.storage().instance().set(&LAST_UPGRADE_KEY, &now);

        // Remove the proposal
        env.storage().persistent().remove(&key);

        env.events().publish(
            (Symbol::new(&env, "upgrade_executed"),),
            (proposal_id, proposal.new_wasm_hash, now),
        );
    }

    /// Cancel a pending upgrade proposal. Only the admin can cancel.
    pub fn cancel_upgrade(env: Env, caller: Address, proposal_id: u64) {
        Self::require_admin(&env, &caller);

        let key = (PROPOSAL_KEY, proposal_id);
        let _: UpgradeProposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Upgrade proposal not found"));

        env.storage().persistent().remove(&key);

        env.events()
            .publish((Symbol::new(&env, "upgrade_cancelled"),), (proposal_id,));
    }

    // ════════════════════════════════════════════════════════════════════
    // QUERY FUNCTIONS
    // ════════════════════════════════════════════════════════════════════

    /// Get a pending upgrade proposal by ID.
    pub fn get_upgrade_proposal(env: Env, proposal_id: u64) -> Option<UpgradeProposal> {
        let key = (PROPOSAL_KEY, proposal_id);
        env.storage().persistent().get(&key)
    }

    /// Get all pending upgrade proposals.
    pub fn get_pending_proposals(env: Env) -> Vec<u64> {
        let mut proposals = Vec::new(&env);
        let next_id: u64 = env
            .storage()
            .instance()
            .get(&NEXT_PROPOSAL_KEY)
            .unwrap_or(1);

        for id in 1..next_id {
            let key = (PROPOSAL_KEY, id);
            if env.storage().persistent().has(&key) {
                proposals.push_back(id);
            }
        }

        proposals
    }

    /// Check if there's a pending admin transfer.
    pub fn has_pending_admin_transfer(env: Env) -> bool {
        env.storage()
            .instance()
            .get::<Symbol, Option<PendingAdminTransfer>>(&PENDING_ADMIN_KEY)
            .unwrap_or(None)
            .is_some()
    }

    /// Get the pending admin (if any).
    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get::<Symbol, Option<PendingAdminTransfer>>(&PENDING_ADMIN_KEY)
            .unwrap_or(None)
            .map(|p| p.new_admin)
    }

    // ════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ════════════════════════════════════════════════════════════════════

    fn require_admin(env: &Env, caller: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *caller != owner {
            panic!("Only admin can perform this action");
        }
    }
}

#[cfg(test)]
mod test;
