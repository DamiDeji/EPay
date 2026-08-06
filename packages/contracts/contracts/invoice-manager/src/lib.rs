#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

const OWNER_KEY: Symbol = Symbol::short("owner");
const NEXT_ID_KEY: Symbol = Symbol::short("next_id");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum InvoiceStatus { Draft, Issued, Sent, Viewed, Paid, Overdue, Cancelled, Refunded }

#[contracttype]
#[derive(Clone)]
pub struct InvoiceData {
    pub invoice_id: u64,
    pub merchant: Address,
    pub customer: Option<Address>,
    pub amount: i128,
    pub asset_code: String,
    pub status: InvoiceStatus,
    pub due_date: u64,
    pub paid_amount: Option<i128>,
    pub paid_at: Option<u64>,
    pub payment_id: Option<u64>,
    pub created_at: u64,
}

#[contract]
pub struct InvoiceManager;

#[contractimpl]
impl InvoiceManager {
    pub fn init(env: Env, owner: Address) {
        if env.storage().instance().has(&OWNER_KEY) { panic!("Already initialized"); }
        env.storage().instance().set(&OWNER_KEY, &owner);
        env.storage().instance().set(&NEXT_ID_KEY, &1u64);
    }

    pub fn create_invoice(env: Env, merchant: Address, customer: Option<Address>, amount: i128, asset_code: String, due_date: u64) -> u64 {
        let invoice_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(1);
        env.storage().instance().set(&NEXT_ID_KEY, &(invoice_id + 1));
        let now = env.ledger().timestamp();
        let invoice = InvoiceData { invoice_id, merchant, customer, amount, asset_code, status: InvoiceStatus::Draft, due_date, paid_amount: None, paid_at: None, payment_id: None, created_at: now };
        env.storage().persistent().set(&invoice_id, &invoice);
        env.events().publish((Symbol::short("invoice_created"),), (invoice_id, amount));
        invoice_id
    }

    pub fn issue_invoice(env: Env, invoice_id: u64) {
        let mut invoice: InvoiceData = env.storage().persistent().get(&invoice_id).unwrap_or_else(|| panic!("Invoice not found"));
        invoice.status = InvoiceStatus::Issued;
        env.storage().persistent().set(&invoice_id, &invoice);
        env.events().publish((Symbol::short("invoice_issued"),), (invoice_id,));
    }

    pub fn pay_invoice(env: Env, invoice_id: u64, payment_id: u64) {
        let mut invoice: InvoiceData = env.storage().persistent().get(&invoice_id).unwrap_or_else(|| panic!("Invoice not found"));
        let now = env.ledger().timestamp();
        invoice.status = InvoiceStatus::Paid;
        invoice.paid_amount = Some(invoice.amount);
        invoice.paid_at = Some(now);
        invoice.payment_id = Some(payment_id);
        env.storage().persistent().set(&invoice_id, &invoice);
        env.events().publish((Symbol::short("invoice_paid"),), (invoice_id,));
    }

    pub fn cancel_invoice(env: Env, invoice_id: u64) {
        let mut invoice: InvoiceData = env.storage().persistent().get(&invoice_id).unwrap_or_else(|| panic!("Invoice not found"));
        invoice.status = InvoiceStatus::Cancelled;
        env.storage().persistent().set(&invoice_id, &invoice);
        env.events().publish((Symbol::short("invoice_cancelled"),), (invoice_id,));
    }

    pub fn mark_overdue(env: Env, invoice_id: u64) {
        let mut invoice: InvoiceData = env.storage().persistent().get(&invoice_id).unwrap_or_else(|| panic!("Invoice not found"));
        invoice.status = InvoiceStatus::Overdue;
        env.storage().persistent().set(&invoice_id, &invoice);
    }

    pub fn get_invoice(env: Env, invoice_id: u64) -> Option<InvoiceData> { env.storage().persistent().get(&invoice_id) }
    pub fn invoice_exists(env: Env, invoice_id: u64) -> bool { env.storage().persistent().has(&invoice_id) }
}

#[cfg(test)]
mod test;
