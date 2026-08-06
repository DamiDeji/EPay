#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

const OWNER_KEY: Symbol = Symbol::short("owner");
const NEXT_ID_KEY: Symbol = Symbol::short("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum SubStatus { Active, Paused, Cancelled, Expired, PaymentFailed, Trial }

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum BillingInterval { Daily, Weekly, Monthly, Quarterly, Annually }

#[contracttype]
#[derive(Clone)]
pub struct SubscriptionData {
    pub sub_id: u64,
    pub merchant: Address,
    pub customer: Address,
    pub plan_name: String,
    pub amount: i128,
    pub asset_code: String,
    pub interval: BillingInterval,
    pub status: SubStatus,
    pub payments_made: u32,
    pub max_payments: Option<u32>,
    pub next_billing: u64,
    pub created_at: u64,
    pub cancelled_at: Option<u64>,
}

#[contract]
pub struct SubscriptionManager;

#[contractimpl]
impl SubscriptionManager {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) { panic!("Already initialized"); }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    pub fn create_subscription(env: Env, merchant: Address, customer: Address, plan_name: String, amount: i128, asset_code: String, interval: BillingInterval, max_payments: Option<u32>) -> u64 {
        let sub_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(sub_id + 1));
        let now = env.ledger().timestamp();
        let sub = SubscriptionData { sub_id, merchant, customer, plan_name, amount, asset_code, interval, status: SubStatus::Active, payments_made: 0, max_payments, next_billing: now + 86400 * 30, created_at: now, cancelled_at: None };
        env.storage().persistent().set(&sub_id, &sub);
        env.events().publish((Symbol::short("sub_created"),), (sub_id,));
        sub_id
    }

    pub fn renew(env: Env, sub_id: u64) {
        let mut sub: SubscriptionData = env.storage().persistent().get(&sub_id).unwrap_or_else(|| panic!("Subscription not found"));
        sub.payments_made += 1;
        if let Some(max) = sub.max_payments { if sub.payments_made >= max { sub.status = SubStatus::Cancelled; } }
        let now = env.ledger().timestamp();
        sub.next_billing = now + 86400 * 30;
        env.storage().persistent().set(&sub_id, &sub);
        env.events().publish((Symbol::short("sub_renewed"),), (sub_id,));
    }

    pub fn pause(env: Env, sub_id: u64) {
        let mut sub: SubscriptionData = env.storage().persistent().get(&sub_id).unwrap_or_else(|| panic!("Subscription not found"));
        sub.status = SubStatus::Paused;
        env.storage().persistent().set(&sub_id, &sub);
        env.events().publish((Symbol::short("sub_paused"),), (sub_id,));
    }

    pub fn cancel(env: Env, sub_id: u64) {
        let mut sub: SubscriptionData = env.storage().persistent().get(&sub_id).unwrap_or_else(|| panic!("Subscription not found"));
        sub.status = SubStatus::Cancelled;
        sub.cancelled_at = Some(env.ledger().timestamp());
        env.storage().persistent().set(&sub_id, &sub);
        env.events().publish((Symbol::short("sub_cancelled"),), (sub_id,));
    }

    pub fn get_subscription(env: Env, sub_id: u64) -> Option<SubscriptionData> { env.storage().persistent().get(&sub_id) }
    pub fn subscription_exists(env: Env, sub_id: u64) -> bool { env.storage().persistent().has(&sub_id) }
}

#[cfg(test)]
mod test;
