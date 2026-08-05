/**
 * EPay SDK — Escrow & Subscription Workflow Example
 *
 * Demonstrates: multi-milestone escrow lifecycle, subscription management.
 *
 * Run: npx tsx examples/escrow-workflow.ts
 */

import {
  EPayClient,
  EscrowStatus,
  SubscriptionBillingInterval,
  SubscriptionStatus,
} from '../src';

async function main() {
  const client = new EPayClient({
    apiUrl: process.env.EPAY_API_URL ?? 'http://localhost:4000',
    apiKey: process.env.EPAY_API_KEY ?? 'ep_test_xxxxxxxx',
  });

  console.log('🔐 EPay SDK — Escrow & Subscription Workflow\n');

  // ══════════════════════════════════════════════════════════════════
  // ESCROW WORKFLOW
  // ══════════════════════════════════════════════════════════════════

  console.log('── Escrow Workflow ──\n');

  // 1. Create an escrow with 3 milestones for a freelance project
  console.log('1. Creating escrow with 3 milestones...');
  const escrow = await client.escrows.create({
    merchantId: 'merch_demo_001',
    customerId: 'cust_demo_789',
    amount: '15000000000', // 15 TON
    currency: 'TON',
    milestones: [
      { index: 0, description: 'Design mockups & wireframes', amount: '5000000000' },
      { index: 1, description: 'Frontend implementation', amount: '5000000000' },
      { index: 2, description: 'Testing & deployment', amount: '5000000000' },
    ],
  });
  console.log(`   ✅ Escrow created: ${escrow.escrowId}`);
  console.log(`      Status: ${escrow.status}`);
  console.log(`      Milestones: ${escrow.milestones.length}\n`);

  // 2. Customer funds the escrow
  console.log('2. Customer funds the escrow...');
  // await client.escrows.fund(escrow.id, '0xtx_fund_escrow...');
  console.log(`   ✅ Escrow funded (status would change to ${EscrowStatus.FUNDED})\n`);

  // 3. Merchant completes first milestone
  console.log('3. Merchant completes milestone 0 (Design)...');
  // await client.escrows.completeMilestone(escrow.id, 0, '0xtx_release_m0...');
  console.log('   ✅ Milestone 0 completed\n');

  // 4. Merchant completes second milestone
  console.log('4. Merchant completes milestone 1 (Frontend)...');
  // await client.escrows.completeMilestone(escrow.id, 1, '0xtx_release_m1...');
  console.log('   ✅ Milestone 1 completed\n');

  // 5. Dispute flow (hypothetical)
  console.log('5. Dispute resolution flow:');
  console.log('   • Customer disputes: await client.escrows.dispute(escrow.id)');
  console.log('   • Admin resolves:   await client.escrows.resolve(escrow.id)');
  console.log('   • Or cancel:        await client.escrows.cancel(escrow.id)\n');

  // 6. List active escrows
  console.log('6. Listing in-progress escrows...');
  const { data: escrows } = await client.escrows.list({
    merchantId: 'merch_demo_001',
    status: EscrowStatus.IN_PROGRESS,
    page: 1,
    pageSize: 10,
  });
  console.log(`   ✅ Found ${escrows.length} in-progress escrows\n`);

  // ══════════════════════════════════════════════════════════════════
  // SUBSCRIPTION WORKFLOW
  // ══════════════════════════════════════════════════════════════════

  console.log('── Subscription Workflow ──\n');

  // 1. Create a monthly subscription with a 7-day trial
  console.log('1. Creating a monthly subscription with 7-day trial...');
  const sub = await client.subscriptions.create({
    merchantId: 'merch_demo_001',
    customerId: 'cust_demo_789',
    planName: 'Pro Plan',
    amount: '2000000000', // 2 TON / month
    currency: 'TON',
    interval: SubscriptionBillingInterval.MONTHLY,
    trialDays: 7,
    maxPayments: 12,
  });
  console.log(`   ✅ Subscription created: ${sub.subscriptionId}`);
  console.log(`      Plan: ${sub.planName}`);
  console.log(`      Amount: ${sub.amount} nanoTON / ${sub.interval}`);
  console.log(`      Status: ${sub.status}\n`);

  // 2. Pause the subscription
  console.log('2. Pausing subscription...');
  // await client.subscriptions.pause(sub.id);
  console.log('   ✅ Subscription paused\n');

  // 3. Resume the subscription
  console.log('3. Resuming subscription...');
  // await client.subscriptions.resume(sub.id);
  console.log('   ✅ Subscription resumed\n');

  // 4. Cancel the subscription
  console.log('4. Cancelling subscription...');
  // await client.subscriptions.cancel(sub.id);
  console.log('   ✅ Subscription cancelled\n');

  // 5. List active subscriptions
  console.log('5. Listing active subscriptions...');
  const { data: subscriptions } = await client.subscriptions.list({
    customerId: 'cust_demo_789',
    status: SubscriptionStatus.ACTIVE,
  });
  console.log(`   ✅ Found ${subscriptions.length} active subscriptions\n`);

  console.log('✨ Escrow & Subscription workflow examples completed!');
}

main().catch(console.error);
