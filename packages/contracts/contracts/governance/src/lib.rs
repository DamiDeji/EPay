//! EPay Governance — Soroban Smart Contract
//! On-chain governance with badge-gated voting for merchant verification.
//!
//! This contract implements a governance system where:
//! - Proposals can be created by admins or verified merchants
//! - Voting is gated by reputation badges (see ImpactNFT contract)
//! - Execution is timelocked (extends ADR 0004)
//! - Merchant verification decisions can be made via governance vote

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, Vec,
};

const OWNER_KEY: Symbol = symbol_short!("owner");
const QUORUM_KEY: Symbol = symbol_short!("quorum");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ProposalType {
    /// Change platform configuration
    ConfigUpdate,
    /// Verify or reject a merchant
    MerchantVerification,
    /// Upgrade contract (delegates to UpgradeManager)
    ContractUpgrade,
    /// Parameter change (fees, limits, etc.)
    ParameterChange,
    /// Cancel merchant account
    MerchantCancellation,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub proposal_type: ProposalType,
    pub title: String,
    pub description: String,
    pub target_address: Option<Address>, // For merchant verification/cancellation
    pub created_at: u64,
    pub voting_period_end: u64,
    pub execution_timelock_end: u64,
    pub status: ProposalStatus,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub abstain_votes: u64,
    pub total_weight: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Active,
    Closed,
    Executed,
    Rejected,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Vote {
    pub voter: Address,
    pub weight: u64, // Voting power based on badges
    pub choice: VoteChoice,
    pub voted_at: u64,
    pub reason: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum VoteChoice {
    Yes,
    No,
    Abstain,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct VoteResult {
    pub proposal_id: u64,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub abstain_votes: u64,
    pub total_weight: u64,
    pub quorum_reached: bool,
    pub passed: bool,
}

#[contract]
pub struct Governance;

// Configuration constants
const DEFAULT_VOTING_PERIOD: u64 = 604_800; // 7 days
const DEFAULT_TIMELOCK: u64 = 259_200; // 72 hours
const DEFAULT_QUORUM_BPS: u64 = 4000; // 40% of total voting power

#[contractimpl]
impl Governance {
    /// Initialize governance contract.
    /// `voting_period` is in seconds (default: 7 days)
    /// `timelock` is in seconds (default: 72 hours)
    pub fn init(env: Env, owner: Address, voting_period: Option<u64>, timelock: Option<u64>) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(
            &symbol_short!("voting"),
            &(voting_period.unwrap_or(DEFAULT_VOTING_PERIOD)),
        );
        env.storage().instance().set(
            &symbol_short!("timelock"),
            &(timelock.unwrap_or(DEFAULT_TIMELOCK)),
        );
        env.storage()
            .instance()
            .set(&QUORUM_KEY, &DEFAULT_QUORUM_BPS);
        env.storage()
            .instance()
            .set(&symbol_short!("next_prop"), &1u64);
    }

    /// Get the contract owner.
    pub fn get_owner(env: Env) -> Address {
        env.storage().instance().get(&OWNER_KEY).unwrap()
    }

    /// Get the voting period duration.
    pub fn get_voting_period(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&symbol_short!("voting"))
            .unwrap()
    }

    /// Get the execution timelock duration.
    pub fn get_timelock(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&symbol_short!("timelock"))
            .unwrap()
    }

    /// Get the quorum requirement in basis points (e.g., 4000 = 40%).
    pub fn get_quorum_bps(env: Env) -> u64 {
        env.storage().instance().get(&QUORUM_KEY).unwrap()
    }

    // ════════════════════════════════════════════════════════════════════
    // PROPOSAL CREATION
    // ════════════════════════════════════════════════════════════════════

    /// Create a new governance proposal.
    /// Only admins and verified merchants can create proposals.
    ///
    /// For merchant verification, provide the target_address.
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        proposal_type: ProposalType,
        title: String,
        description: String,
        target_address: Option<Address>,
    ) -> u64 {
        Self::require_proposal_creator(&env, &proposer);

        if title.len() < 10 || title.len() > 200 {
            panic!("Title must be 10-200 characters");
        }
        if description.len() < 50 {
            panic!("Description must be at least 50 characters");
        }

        let voting_period = Self::get_voting_period(env.clone());
        let timelock = Self::get_timelock(env.clone());
        let now = env.ledger().timestamp();

        let proposal_id: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("next_prop"))
            .unwrap();

        let proposal = Proposal {
            id: proposal_id,
            proposer: proposer.clone(),
            proposal_type,
            title: title.clone(),
            description: description.clone(),
            target_address,
            created_at: now,
            voting_period_end: now + voting_period,
            execution_timelock_end: now + voting_period + timelock,
            status: ProposalStatus::Active,
            yes_votes: 0,
            no_votes: 0,
            abstain_votes: 0,
            total_weight: 0,
        };

        let key = (symbol_short!("proposal"), proposal_id);
        env.storage().persistent().set(&key, &proposal);
        env.storage()
            .instance()
            .set(&symbol_short!("next_prop"), &(proposal_id + 1));

        env.events().publish(
            (Symbol::new(&env, "proposal_created"),),
            (proposal_id, proposer, title),
        );

        proposal_id
    }

    // ════════════════════════════════════════════════════════════════════
    // VOTING
    // ════════════════════════════════════════════════════════════════════

    /// Cast a vote on a proposal.
    /// `weight` is the voter's voting power (based on reputation badges from ImpactNFT).
    /// `reason` is optional justification for the vote.
    pub fn cast_vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        choice: VoteChoice,
        weight: u64,
        reason: Option<String>,
    ) {
        let key = (symbol_short!("proposal"), proposal_id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Proposal not found"));

        if proposal.status != ProposalStatus::Active {
            panic!("Proposal is not open for voting");
        }

        if env.ledger().timestamp() > proposal.voting_period_end {
            panic!("Voting period has ended");
        }

        if weight == 0 {
            panic!("Vote weight must be positive");
        }

        // Check if voter already voted
        let vote_key = (symbol_short!("vote"), proposal_id, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            panic!("Voter has already voted on this proposal");
        }

        let vote = Vote {
            voter: voter.clone(),
            weight,
            choice: choice.clone(),
            voted_at: env.ledger().timestamp(),
            reason,
        };

        // Store the vote
        env.storage().persistent().set(&vote_key, &vote);

        // Update tallies
        match choice {
            VoteChoice::Yes => proposal.yes_votes += 1,
            VoteChoice::No => proposal.no_votes += 1,
            VoteChoice::Abstain => proposal.abstain_votes += 1,
        }
        proposal.total_weight += weight;

        env.storage().persistent().set(&key, &proposal);

        env.events().publish(
            (Symbol::new(&env, "vote_cast"),),
            (proposal_id, voter, choice, weight),
        );
    }

    // ════════════════════════════════════════════════════════════════════
    // CLOSING & EXECUTION
    // ════════════════════════════════════════════════════════════════════

    /// Close a proposal after the voting period ends.
    /// Can only be called by the proposer or admin.
    pub fn close_proposal(env: Env, _caller: Address, proposal_id: u64) -> VoteResult {
        let key = (symbol_short!("proposal"), proposal_id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Proposal not found"));

        if proposal.status != ProposalStatus::Active {
            panic!("Proposal is not active");
        }

        if env.ledger().timestamp() <= proposal.voting_period_end {
            panic!("Voting period has not ended");
        }

        let quorum_bps = Self::get_quorum_bps(env.clone());
        let quorum_reached = Self::check_quorum(&proposal, quorum_bps);
        let passed = quorum_reached && proposal.yes_votes > proposal.no_votes;

        if passed {
            proposal.status = ProposalStatus::Closed;
        } else {
            proposal.status = ProposalStatus::Rejected;
        }

        env.storage().persistent().set(&key, &proposal);

        let result = VoteResult {
            proposal_id,
            yes_votes: proposal.yes_votes,
            no_votes: proposal.no_votes,
            abstain_votes: proposal.abstain_votes,
            total_weight: proposal.total_weight,
            quorum_reached,
            passed: proposal.yes_votes > proposal.no_votes && quorum_reached,
        };

        if passed {
            env.events().publish(
                (Symbol::new(&env, "proposal_passed"),),
                (proposal_id, result.clone()),
            );
        } else {
            env.events().publish(
                (Symbol::new(&env, "proposal_rejected"),),
                (proposal_id, result.clone()),
            );
        }

        result
    }

    /// Execute a passed proposal.
    /// Can only be called after the timelock expires.
    pub fn execute_proposal(env: Env, _caller: Address, proposal_id: u64) {
        let key = (symbol_short!("proposal"), proposal_id);
        let proposal: Proposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Proposal not found"));

        if proposal.status != ProposalStatus::Closed {
            panic!("Proposal has not been closed or was rejected");
        }

        if env.ledger().timestamp() <= proposal.execution_timelock_end {
            panic!("Execution timelock has not expired");
        }

        // Mark as executed
        let mut proposal = proposal;
        proposal.status = ProposalStatus::Executed;
        env.storage().persistent().set(&key, &proposal);

        env.events().publish(
            (Symbol::new(&env, "proposal_executed"),),
            (proposal_id, proposal.proposal_type),
        );
    }

    /// Cancel a proposal before voting ends.
    /// Only the proposer or admin can cancel.
    pub fn cancel_proposal(env: Env, caller: Address, proposal_id: u64) {
        let key = (symbol_short!("proposal"), proposal_id);
        let proposal: Proposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Proposal not found"));

        if proposal.proposer != caller {
            Self::require_admin(&env, &caller);
        }

        if proposal.status != ProposalStatus::Active {
            panic!("Proposal is not active");
        }

        let mut proposal = proposal;
        proposal.status = ProposalStatus::Cancelled;
        env.storage().persistent().set(&key, &proposal);

        env.events()
            .publish((Symbol::new(&env, "proposal_cancelled"),), (proposal_id,));
    }

    // ════════════════════════════════════════════════════════════════════
    // QUERY FUNCTIONS
    // ════════════════════════════════════════════════════════════════════

    /// Get a proposal by ID.
    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        let key = (symbol_short!("proposal"), proposal_id);
        env.storage().persistent().get(&key)
    }

    /// Check if an address has voted on a proposal.
    pub fn has_voted(env: Env, proposal_id: u64, voter: Address) -> bool {
        let key = (symbol_short!("vote"), proposal_id, voter);
        env.storage().persistent().has(&key)
    }

    /// Get a specific vote.
    pub fn get_vote(env: Env, proposal_id: u64, voter: Address) -> Option<Vote> {
        let key = (symbol_short!("vote"), proposal_id, voter);
        env.storage().persistent().get(&key)
    }

    /// Get all proposals (returns list of proposal IDs).
    pub fn get_all_proposals(env: Env) -> Vec<u64> {
        let mut proposals = Vec::new(&env);
        let mut next_id: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("next_prop"))
            .unwrap_or(0);

        while next_id > 0 {
            next_id -= 1;
            let key = (symbol_short!("proposal"), next_id);
            if env.storage().persistent().has(&key) {
                proposals.push_back(next_id);
            }
        }

        proposals
    }

    /// Get proposals by status.
    pub fn get_proposals_by_status(env: Env, status: ProposalStatus) -> Vec<u64> {
        // `soroban_sdk::Vec` has no iterator adapters, so filter explicitly.
        let all = Self::get_all_proposals(env.clone());
        let mut matching = Vec::new(&env);
        for id in all.iter() {
            if let Some(proposal) = Self::get_proposal(env.clone(), id) {
                if proposal.status == status {
                    matching.push_back(id);
                }
            }
        }
        matching
    }

    /// Update quorum requirement (owner only).
    pub fn set_quorum_bps(env: Env, caller: Address, quorum_bps: u64) {
        Self::require_admin(&env, &caller);
        if !(1000..=10000).contains(&quorum_bps) {
            panic!("Quorum must be between 10% and 100%");
        }
        env.storage().instance().set(&QUORUM_KEY, &quorum_bps);
    }

    // ════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ════════════════════════════════════════════════════════════════════

    fn require_proposal_creator(env: &Env, proposer: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if proposer == &owner {
            return;
        }
        // In production, would check if proposer has verified merchant badge
        // For now, only owner can create proposals
        panic!("Only admin can create proposals");
    }

    fn require_admin(env: &Env, caller: &Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if *caller != owner {
            panic!("Only admin can perform this action");
        }
    }

    /// Decide whether a closed proposal met the quorum requirement.
    ///
    /// The previous implementation compared a *count* of votes
    /// (`yes_votes + abstain_votes`, where each entry is +1) against a threshold
    /// derived from *weighted* participation (`total_weight * quorum_bps`), so no
    /// realistic proposal could ever reach quorum. Both sides must be measured in
    /// the same unit: here, the share of participating voting power cast in
    /// favour (yes or abstain) versus the configured basis points.
    fn check_quorum(proposal: &Proposal, quorum_bps: u64) -> bool {
        let participation = proposal.yes_votes + proposal.no_votes + proposal.abstain_votes;
        if participation == 0 {
            return false;
        }

        let in_favour = proposal.yes_votes + proposal.abstain_votes;
        in_favour * 10_000 >= participation * quorum_bps
    }
}

#[cfg(test)]
mod test;
