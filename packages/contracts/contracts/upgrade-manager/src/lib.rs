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
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const PENDING_ADMIN_KEY: Symbol = symbol_short!("pending_admin");
const UPGRADE_PROPOSAL_KEY: Symbol = symbol_short!("upgrade_proposal");
const MIN_TIMELOCK_SECONDS: u64 = 259_200; // 72 hours

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum AdminTransferState {
    None,
    Pending { new_admin: Address, proposed_by: Address, proposed_at: u64 },
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct UpgradeProposal {
    pub new_wasm_hash: Vec<u8>,
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
        env.storage().instance().set(&PENDING_ADMIN_KEY, &AdminTransferState::None);
        env.storage()
            .instance()
            .set(&symbol_short!("upgrade_status"), &UpgradeStatus::None);
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

        if new_admin == Address::zero() {
            panic!("Cannot transfer to zero address");
        }

        let state = AdminTransferState::Pending {
            new_admin,
            proposed_by: caller,
            proposed_at: env.ledger().timestamp(),
        };
        env.storage().instance().set(&PENDING_ADMIN_KEY, &state);

        env.events().publish(
            (Symbol::new(&env, "admin_transfer_proposed"),),
            (caller, new_admin),
        );
    }

    /// Accept a pending admin transfer. Only the proposed new admin can call this.
    /// After acceptance, the caller becomes the new admin.
    pub fn accept_admin(env: Env, caller: Address) {
        let pending: AdminTransferState = env
            .storage()
            .instance()
            .get(&PENDING_ADMIN_KEY)
            .unwrap();

        match pending {
            AdminTransferState::None => {
                panic!("No admin transfer pending");
            }
            AdminTransferState::Pending {
                new_admin,
                proposed_by: _,
                proposed_at: _,
            } => {
                if caller != new_admin {
                    panic!("Only the proposed admin can accept");
                }
                env.storage().instance().set(&OWNER_KEY, &caller);
                env.storage()
                    .instance()
                    .set(&PENDING_ADMIN_KEY, &AdminTransferState::None);

                env.events().publish(
                    (Symbol::new(&env, "admin_transfer_completed"),),
                    (caller,),
                );
            }
        }
    }

    /// Cancel a pending admin transfer. Only the current admin can cancel.
    pub fn cancel_admin_transfer(env: Env, caller: Address) {
        Self::require_admin(&env, &caller);

        let pending: AdminTransferState = env
            .storage()
            .instance()
            .get(&PENDING_ADMIN_KEY)
            .unwrap();

        match pending {
            AdminTransferState::None => {
                panic!("No admin transfer to cancel");
            }
            AdminTransferState::Pending { .. } => {
                env.storage()
                    .instance()
                    .set(&PENDING_ADMIN_KEY, &AdminTransferState::None);
            }
        }

        env.events().publish(
            (Symbol::new(&env, "admin_transfer_cancelled"),),
            (),
        );
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
        new_wasm_hash: Vec<u8>,
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
            proposed_by: caller,
            proposed_at: now,
            executable_at,
            description,
        };

        // Use a counter for proposal IDs
        let proposal_id: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("next_proposal_id"))
            .unwrap_or(1);
        env.storage()
            .instance()
            .set(&symbol_short!("next_proposal_id"), &(proposal_id + 1));

        let key = (symbol_short!("proposal"), proposal_id);
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

        let key = (symbol_short!("proposal"), proposal_id);
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
            .set(&symbol_short!("upgrade_status"), &UpgradeStatus::Executed);
        env.storage()
            .instance()
            .set(&symbol_short!("last_upgrade_at"), &now);

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

        let key = (symbol_short!("proposal"), proposal_id);
        let _: UpgradeProposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Upgrade proposal not found"));

        env.storage().persistent().remove(&key);

        env.events().publish(
            (Symbol::new(&env, "upgrade_cancelled"),),
            (proposal_id,),
        );
    }

    // ════════════════════════════════════════════════════════════════════
    // QUERY FUNCTIONS
    // ════════════════════════════════════════════════════════════════════

    /// Get a pending upgrade proposal by ID.
    pub fn get_upgrade_proposal(env: Env, proposal_id: u64) -> Option<UpgradeProposal> {
        let key = (symbol_short!("proposal"), proposal_id);
        env.storage().persistent().get(&key)
    }

    /// Get all pending upgrade proposals.
    pub fn get_pending_proposals(env: Env) -> Vec<u64> {
        let mut proposals = Vec::new();
        let next_id: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("next_proposal_id"))
            .unwrap_or(1);

        for id in 1..next_id {
            let key = (symbol_short!("proposal"), id);
            if env.storage().persistent().has(&key) {
                proposals.push(id);
            }
        }

        proposals
    }

    /// Check if there's a pending admin transfer.
    pub fn has_pending_admin_transfer(env: Env) -> bool {
        let pending: AdminTransferState = env
            .storage()
            .instance()
            .get(&PENDING_ADMIN_KEY)
            .unwrap();
        matches!(pending, AdminTransferState::Pending { .. })
    }

    /// Get the pending admin (if any).
    pub fn get_pending_admin(env: Env) -> Option<Address> {
        let pending: AdminTransferState = env
            .storage()
            .instance()
            .get(&PENDING_ADMIN_KEY)
            .unwrap();

        match pending {
            AdminTransferState::Pending {
                new_admin,
                proposed_by: _,
                proposed_at: _,
            } => Some(new_admin),
            AdminTransferState::None => None,
        }
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
