#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

const OWNER_KEY: Symbol = Symbol::short("owner");

#[contracttype]
#[derive(Clone)]
pub struct PauseState { pub is_paused: bool, pub paused_at: Option<u64>, pub reason: Option<String>, pub paused_by: Option<Address> }

#[contract]
pub struct EmergencyPause;

#[contractimpl]
impl EmergencyPause {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) { panic!("Already initialized"); }
        env.storage().instance().set(&OWNER_KEY, &owner);
        let state = PauseState { is_paused: false, paused_at: None, reason: None, paused_by: None };
        env.storage().instance().set(&Symbol::short("state"), &state);
    }

    pub fn pause(env: Env, caller: Address, reason: String) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if caller != owner { panic!("Only owner can pause"); }
        let state = PauseState { is_paused: true, paused_at: Some(env.ledger().timestamp()), reason: Some(reason), paused_by: Some(caller) };
        env.storage().instance().set(&Symbol::short("state"), &state);
        env.events().publish((Symbol::short("paused"),), ());
    }

    pub fn unpause(env: Env, caller: Address) {
        let owner: Address = env.storage().instance().get(&OWNER_KEY).unwrap();
        if caller != owner { panic!("Only owner can unpause"); }
        let state = PauseState { is_paused: false, paused_at: None, reason: None, paused_by: None };
        env.storage().instance().set(&Symbol::short("state"), &state);
        env.events().publish((Symbol::short("unpaused"),), ());
    }

    pub fn is_paused(env: Env) -> bool {
        let state: PauseState = env.storage().instance().get(&Symbol::short("state")).unwrap();
        state.is_paused
    }

    pub fn require_not_paused(env: Env) {
        if Self::is_paused(env) { panic!("Contract is paused"); }
    }
}

#[cfg(test)]
mod test;
