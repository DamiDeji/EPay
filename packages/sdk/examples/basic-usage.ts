/**
 * EPay SDK — Basic Usage Example
 *
 * Demonstrates: client setup, creating payments, invoices, pagination, error handling.
 *
 * Run: npx tsx examples/basic-usage.ts
 */

import { EPayClient, PaymentStatus, InvoiceStatus, EPayError } from '../src';

async function main() {
  // ── 1. Initialize the client ────────────────────────────────────────
  const client = new EPayClient({
    apiUrl: process.env.EPAY_API_URL ?? 'http://localhost:4000',
    apiKey: process.env.EPAY_API_KEY ?? 'ep_test_xxxxxxxx',
  });

  console.log('🚀 EPay SDK — Basic Usage Example\n');

  try {
    // ── 2. Create a payment ───────────────────────────────────────────
    console.log('Creating a payment...');
    const payment = await client.payments.create({
      merchantId: 'merch_demo_001',
      amount: '1000000000', // 1 XLM in stroops
      currency: 'XLM',
      recipientAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU',
      description: 'Demo payment for SDK example',
      memo: 'SDK example',
      expiresIn: 3600,
    });
    console.log(`  ✅ Payment created: ${payment.paymentId}`);
    console.log(`     Amount: ${payment.amount} stroops`);
    console.log(`     Status: ${payment.status}\n`);

    // ── 3. Get payment by ID ──────────────────────────────────────────
    console.log('Fetching payment...');
    const fetched = await client.payments.getById(payment.id);
    console.log(`  ✅ Retrieved: ${fetched.paymentId}\n`);

    // ── 4. List payments with pagination ──────────────────────────────
    console.log('Listing payments (page 1, 10 per page)...');
    const { data, total, page, totalPages, hasNext } = await client.payments.list({
      merchantId: 'merch_demo_001',
      status: PaymentStatus.PENDING,
      page: 1,
      pageSize: 10,
    });
    console.log(`  ✅ Found ${total} payments (page ${page}/${totalPages})`);
    console.log(`     Has next page: ${hasNext}\n`);

    // ── 5. Create an invoice ──────────────────────────────────────────
    console.log('Creating an invoice...');
    const invoice = await client.invoices.create({
      merchantId: 'merch_demo_001',
      amount: '5000000000',
      currency: 'XLM',
      items: [
        { description: 'Consulting hours (5h)', quantity: 5, unitPrice: '800000000', total: '4000000000' },
        { description: 'Project setup fee', quantity: 1, unitPrice: '1000000000', total: '1000000000' },
      ],
      dueDate: new Date(Date.now() + 30 * 86400_000),
      notes: 'Invoice for Q3 consulting services',
    });
    console.log(`  ✅ Invoice created: ${invoice.invoiceNumber}`);
    console.log(`     Total: ${invoice.amount} stroops`);
    console.log(`     Items: ${invoice.items.length}`);
    console.log(`     Status: ${invoice.status}\n`);

    // ── 6. Issue the invoice ──────────────────────────────────────────
    console.log('Issuing invoice...');
    await client.invoices.issue(invoice.id);
    console.log(`  ✅ Invoice ${invoice.invoiceNumber} issued\n`);

    // ── 7. List invoices ──────────────────────────────────────────────
    console.log('Listing invoices...');
    const { data: invoices } = await client.invoices.list({
      merchantId: 'merch_demo_001',
      status: InvoiceStatus.ISSUED,
    });
    console.log(`  ✅ Found ${invoices.length} issued invoices\n`);

    console.log('✨ All examples completed successfully!');
  } catch (error) {
    if (error instanceof EPayError) {
      console.error(`❌ EPay API Error [${error.statusCode}]: ${error.message}`);
      if (error.errors) {
        for (const e of error.errors) {
          console.error(`   • ${e.field ?? '(general)'}: ${e.message}`);
        }
      }
    } else {
      console.error('❌ Unexpected error:', error);
    }
  }
}

main();
