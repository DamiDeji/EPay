#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

const OWNER_KEY: Symbol = symbol_short!("owner");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum Role {
    Admin,
    Verifier,
    Operator,
    Auditor,
}

#[contracttype]
#[derive(Clone)]
pub struct RoleAssignment {
    pub address: Address,
    pub role: Role,
    pub assigned_at: u64,
    pub assigned_by: Address,
}

#[contract]
pub struct RoleManager;

#[contractimpl]
impl RoleManager {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&OWNER_KEY, &owner);
        let role_key = (Role::Admin, owner.clone());
        env.storage().persistent().set(&role_key, &true);
    }

    pub fn assign_role(env: Env, admin: Address, target: Address, role: Role) {
        Self::require_role(&env, &admin, Role::Admin);
        let role_key = (role.clone(), target.clone());
        env.storage().persistent().set(&role_key, &true);
        env.events()
            .publish((Symbol::new(&env, "role_assigned"),), (target, role));
    }

    pub fn revoke_role(env: Env, admin: Address, target: Address, role: Role) {
        Self::require_role(&env, &admin, Role::Admin);
        let role_key = (role.clone(), target.clone());
        env.storage().persistent().remove(&role_key);
        env.events()
            .publish((Symbol::new(&env, "role_revoked"),), (target, role));
    }

    pub fn has_role(env: Env, address: Address, role: Role) -> bool {
        env.storage()
            .persistent()
            .get(&(role, address))
            .unwrap_or(false)
    }

    fn require_role(env: &Env, address: &Address, role: Role) {
        if !env
            .storage()
            .persistent()
            .get(&(role, address.clone()))
            .unwrap_or(false)
        {
            panic!("Missing required role");
        }
    }
}

#[cfg(test)]
mod test;
