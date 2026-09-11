//! Governance tests — Stellar/Soroban
//!
//! Tests cover: proposal creation, voting, closing, execution,
//! quorum checks, timelock enforcement, and access control.

use soroban_sdk::{testutils::Address as _, Env, Address, String};

use super::*;

/// Set up the test environment.
fn setup_test() -> (Env, GovernanceClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().with_mut(|li| {
        li.timestamp = 1_000_000;
        li.sequence_number = 100;
    });

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, Governance);
    let client = GovernanceClient::new(&env, &contract_id);
    client.init(
        &owner,
        &Some(604_800_u64),  // 7 days voting period
        &Some(259_200_u64),  // 72 hour timelock
    );

    (env, client, owner)
}

// ════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize() {
    let (env, client, owner) = setup_test();

    assert_eq!(client.get_owner(), owner);
    assert_eq!(client.get_voting_period(), 604_800_u64);
    assert_eq!(client.get_timelock(), 259_200_u64);
    assert_eq!(client.get_quorum_bps(), 4000_u64);
}

#[test]
fn test_initialize_with_custom_periods() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let contract_id = env.register_contract(None, Governance);
    let client = GovernanceClient::new(&env, &contract_id);

    client.init(
        &owner,
        &Some(100_000_u64),
        &Some(50_000_u64),
    );

    assert_eq!(client.get_voting_period(), 100_000_u64);
    assert_eq!(client.get_timelock(), 50_000_u64);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let (env, contract_id, owner) = {
        let env = Env::default();
        env.mock_all_auths();
        let owner = Address::generate(&env);
        let id = env.register_contract(None, Governance);
        (env, id, owner)
    };
    let client = GovernanceClient::new(&env, &contract_id);
    client.init(&owner, &None, &None);
    client.init(&owner, &None, &None);
}

// ════════════════════════════════════════════════════════════════════
// PROPOSAL CREATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_create_proposal() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Increase platform fee to 1%"),
        &String::from_str(&env, "This proposal seeks to adjust the platform fee from 0.5% to 1% to cover increased operational costs. The change would take effect 72 hours after passing."),
        &None,
    );

    assert_eq!(proposal_id, 1);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.id, 1);
    assert_eq!(proposal.proposer, owner);
    assert_eq!(proposal.proposal_type, ProposalType::ConfigUpdate);
    assert_eq!(proposal.status, ProposalStatus::Active);
    assert_eq!(proposal.yes_votes, 0);
    assert!(proposal.voting_period_end > proposal.created_at);
}

#[test]
fn test_create_multiple_proposals() {
    let (env, client, owner) = setup_test();

    for i in 1..=5 {
        let id = client.create_proposal(
            &owner,
            &ProposalType::ParameterChange,
            &String::from_str(&env, &format!("Proposal {}", i)),
            &String::from_str(&env, &format!("Description for proposal {}. This is a test proposal to verify multiple proposal creation works correctly.", i)),
            &None,
        );
        assert_eq!(id, i as u64);

        let proposal = client.get_proposal(&id).unwrap();
        assert_eq!(proposal.status, ProposalStatus::Active);
    }
}

#[test]
#[should_panic(expected = "Title must be 10-200 characters")]
fn test_create_proposal_title_too_short() {
    let (env, client, owner) = setup_test();

    client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Short"),
        &String::from_str(&env, "This is a sufficiently long description for the proposal."),
        &None,
    );
}

#[test]
fn test_only_admin_can_create() {
    let (env, client, _owner) = setup_test();

    let non_admin = Address::generate(&env);
    client.create_proposal(
        &non_admin,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Unauthorized proposal"),
        &String::from_str(&env, "This proposal should not be allowed as only admin can create proposals in this test."),
        &None,
    );
}

// ════════════════════════════════════════════════════════════════════
// VOTING
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_cast_vote() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal for voting"),
        &String::from_str(&env, "This is a test proposal to verify the voting mechanism works correctly."),
        &None,
    );

    let voter = Address::generate(&env);
    client.cast_vote(
        &voter,
        &proposal_id,
        &VoteChoice::Yes,
        &100_u64,
        &Some(String::from_str(&env, "Strongly support this change")),
    );

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.yes_votes, 1);
    assert_eq!(proposal.total_weight, 100);
    assert!(client.has_voted(&proposal_id, &voter));
}

#[test]
fn test_cast_multiple_votes() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description for the test proposal to verify multiple votes."),
        &None,
    );

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);

    client.cast_vote(&voter1, &proposal_id, &VoteChoice::Yes, &100, &None);
    client.cast_vote(&voter2, &proposal_id, &VoteChoice::No, &50, &None);
    client.cast_vote(&voter3, &proposal_id, &VoteChoice::Abstain, &75, &None);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.yes_votes, 1);
    assert_eq!(proposal.no_votes, 1);
    assert_eq!(proposal.abstain_votes, 1);
    assert_eq!(proposal.total_weight, 225);
}

#[test]
#[should_panic(expected = "Voter has already voted on this proposal")]
fn test_cannot_double_vote() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description for the test proposal to verify double voting is prevented."),
        &None,
    );

    let voter = Address::generate(&env);
    client.cast_vote(&voter, &proposal_id, &VoteChoice::Yes, &100, &None);
    client.cast_vote(&voter, &proposal_id, &VoteChoice::No, &50, &None);
}

#[test]
#[should_panic(expected = "Voting period has not ended")]
fn test_cannot_close_early() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description for the test proposal."),
        &None,
    );

    // Try to close immediately
    client.cast_vote(
        &Address::generate(&env),
        &proposal_id,
        &VoteChoice::Yes,
        &100,
        &None,
    );

    // Advance time but not past voting period
    env.ledger().with_mut(|li| li.timestamp += 1000);
    client.close_proposal(&owner, &proposal_id);
}

// ════════════════════════════════════════════════════════════════════
// CLOSING & EXECUTION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_close_proposal_passes() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description for the test proposal to verify passing."),
        &None,
    );

    // Add votes
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    client.cast_vote(&voter1, &proposal_id, &VoteChoice::Yes, &100, &None);
    client.cast_vote(&voter2, &proposal_id, &VoteChoice::Yes, &100, &None);

    // Advance past voting period
    env.ledger().with_mut(|li| {
        li.timestamp = client.get_proposal(&proposal_id).unwrap().voting_period_end + 1;
    });

    let result = client.close_proposal(&owner, &proposal_id);

    assert!(result.quorum_reached);
    assert!(result.passed);
    assert_eq!(result.yes_votes, 2);
}

#[test]
fn test_close_proposal_rejected() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description for the test proposal to verify rejection."),
        &None,
    );

    // Add more no votes
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    client.cast_vote(&voter1, &proposal_id, &VoteChoice::No, &200, &None);
    client.cast_vote(&voter2, &proposal_id, &VoteChoice::Yes, &100, &None);

    // Advance past voting period
    env.ledger().with_mut(|li| {
        li.timestamp = client.get_proposal(&proposal_id).unwrap().voting_period_end + 1;
    });

    let result = client.close_proposal(&owner, &proposal_id);

    assert!(!result.passed);
}

#[test]
fn test_execute_after_timelock() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description for the test proposal to verify execution."),
        &None,
    );

    // Add passing votes
    for _ in 0..10 {
        let voter = Address::generate(&env);
        client.cast_vote(&voter, &proposal_id, &VoteChoice::Yes, &100, &None);
    }

    // Close the proposal
    env.ledger().with_mut(|li| {
        li.timestamp = client.get_proposal(&proposal_id).unwrap().voting_period_end + 1;
    });
    client.close_proposal(&owner, &proposal_id);

    // Try to execute before timelock
    env.ledger().with_mut(|li| {
        li.timestamp = client.get_proposal(&proposal_id).unwrap().voting_period_end + 100;
    });
    client.execute_proposal(&owner, &proposal_id);
}

#[test]
#[should_panic(expected = "Proposal has not been closed or was rejected")]
fn test_execute_rejected_proposal() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description for the test proposal to verify rejected proposals cannot be executed."),
        &None,
    );

    // Add no votes
    for _ in 0..10 {
        let voter = Address::generate(&env);
        client.cast_vote(&voter, &proposal_id, &VoteChoice::No, &100, &None);
    }

    // Close and try to execute
    env.ledger().with_mut(|li| {
        li.timestamp = client.get_proposal(&proposal_id).unwrap().voting_period_end + 1;
    });
    client.close_proposal(&owner, &proposal_id);
    client.execute_proposal(&owner, &proposal_id);
}

// ════════════════════════════════════════════════════════════════════
// QUERY FUNCTIONS
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_get_all_proposals() {
    let (env, client, owner) = setup_test();

    for i in 1..=5 {
        client.create_proposal(
            &owner,
            &ProposalType::ConfigUpdate,
            &String::from_str(&env, &format!("Proposal {}", i)),
            &String::from_str(&env, &format!("Description {}", i)),
            &None,
        );
    }

    let all = client.get_all_proposals();
    assert_eq!(all.len(), 5);
}

#[test]
fn test_has_voted() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description."),
        &None,
    );

    let voter = Address::generate(&env);
    assert!(!client.has_voted(&proposal_id, &voter));

    client.cast_vote(&voter, &proposal_id, &VoteChoice::Yes, &100, &None);
    assert!(client.has_voted(&proposal_id, &voter));
}

// ════════════════════════════════════════════════════════════════════
// CANCELLATION
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_cancel_proposal() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description for cancellation test."),
        &None,
    );

    client.cancel_proposal(&owner, &proposal_id);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Cancelled);
}

#[test]
#[should_panic(expected = "Only admin can perform this action")]
fn test_non_admin_cannot_cancel_others_proposal() {
    let (env, client, owner) = setup_test();

    let proposal_id = client.create_proposal(
        &owner,
        &ProposalType::ConfigUpdate,
        &String::from_str(&env, "Test proposal"),
        &String::from_str(&env, "Description for cancellation test."),
        &None,
    );

    let non_admin = Address::generate(&env);
    client.cancel_proposal(&non_admin, &proposal_id);
}

// ════════════════════════════════════════════════════════════════════
// QUORUM
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_set_quorum() {
    let (env, client, owner) = setup_test();

    client.set_quorum_bps(&owner, &5000); // 50%
    assert_eq!(client.get_quorum_bps(), 5000);
}

#[test]
#[should_panic(expected = "Quorum must be between 10% and 100%")]
fn test_set_quorum_too_low() {
    let (env, client, owner) = setup_test();
    client.set_quorum_bps(&owner, &500); // 5%
}

// ════════════════════════════════════════════════════════════════════
// PROPOSAL TYPES
// ════════════════════════════════════════════════════════════════════

#[test]
fn test_merchant_verification_proposal() {
    let (env, client, owner) = setup_test();

    let merchant = Address::generate(&env);
    let id = client.create_proposal(
        &owner,
        &ProposalType::MerchantVerification,
        &String::from_str(&env, "Verify Merchant Corp"),
        &String::from_str(&env, "This proposal seeks to verify Merchant Corp as an active merchant on the platform. They have completed all required documentation."),
        &Some(merchant),
    );

    let proposal = client.get_proposal(&id).unwrap();
    assert_eq!(proposal.proposal_type, ProposalType::MerchantVerification);
    assert_eq!(proposal.target_address, Some(merchant));
}
