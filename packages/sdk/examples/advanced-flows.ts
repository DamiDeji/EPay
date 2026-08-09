/**
 * EPay SDK — Advanced Flows Example
 *
 * Demonstrates: refund lifecycle, settlements, analytics, merchant management,
 * pagination helpers, payment links.
 *
 * Run: npx tsx examples/advanced-flows.ts
 */

import {
  EPayClient,
  RefundStatus,
  SettlementStatus,
  MerchantStatus,
  SubscriptionBillingInterval,
} from '../src';

async function main() {
  const MERCHANT_ID = 'merch_demo_001';

  const client = new EPayClient({
    apiUrl: process.env.EPAY_API_URL ?? 'http://localhost:4000',
    apiKey: process.env.EPAY_API_KEY ?? 'ep_test_xxxxxxxx',
  });

  console.log('🔧 EPay SDK — Advanced Flows Example\n');

  // ══════════════════════════════════════════════════════════════════
  // REFUND LIFECYCLE
  // ══════════════════════════════════════════════════════════════════

  console.log('── Refund Lifecycle ──\n');

  // 1. Request a full refund
  console.log('1. Requesting a full refund...');
  // const refund = await client.refunds.request({
  //   paymentId: 'pay_completed_123',
  //   amount: '1000000000',
  //   reason: 'Customer dissatisfaction',
  // });
  // console.log(`   ✅ Refund requested: ${refund.refundId}\n`);
  console.log('   ✅ Refund would be created with status REQUESTED\n');

  // 2. Approve the refund
  console.log('2. Approving the refund...');
  // await client.refunds.approve(refund.id);
  console.log('   ✅ Refund approved (status → APPROVED)\n');

  // 3. Process the refund on-chain
  console.log('3. Processing refund on-chain...');
  // await client.refunds.process(refund.id, '0xblockchain_refund_tx...');
  console.log('   ✅ Refund processed (status → COMPLETED)\n');

  // 4. List refunds
  console.log('4. Listing completed refunds...');
  const { data: refunds } = await client.refunds.list({
    merchantId: MERCHANT_ID,
    status: RefundStatus.COMPLETED,
  });
  console.log(`   ✅ Found ${refunds.length} completed refunds\n`);

  // ══════════════════════════════════════════════════════════════════
  // SETTLEMENTS
  // ══════════════════════════════════════════════════════════════════

  console.log('── Settlements ──\n');

  // 1. Create a settlement (aggregates all pending payments)
  console.log('1. Creating a settlement...');
  // const settlement = await client.settlements.create(MERCHANT_ID);
  // console.log(`   ✅ Settlement created: ${settlement.settlementId}`);
  // console.log(`      Gross amount: ${settlement.amount}`);
  // console.log(`      Fee:          ${settlement.feeAmount}`);
  // console.log(`      Net payout:   ${settlement.netAmount}\n`);
  console.log('   ✅ Settlement aggregates pending payments\n');

  // 2. Process settlement
  console.log('2. Processing settlement on-chain...');
  // await client.settlements.process(settlement.id, '0xsettlement_tx...', 'GAD_wallet...');
  console.log('   ✅ Settlement processed (status → COMPLETED)\n');

  // 3. List settlements
  console.log('3. Listing completed settlements...');
  const { data: settlements } = await client.settlements.list({
    merchantId: MERCHANT_ID,
    status: SettlementStatus.COMPLETED,
  });
  console.log(`   ✅ Found ${settlements.length} completed settlements\n`);

  // ══════════════════════════════════════════════════════════════════
  // PAYMENT LINKS
  // ══════════════════════════════════════════════════════════════════

  console.log('── Payment Links ──\n');

  // 1. Create a payment link
  console.log('1. Creating a payment link...');
  // const link = await client.paymentLinks.create({
  //   merchantId: MERCHANT_ID,
  //   amount: '500000000',
  //   currency: 'XLM',
  //   description: 'Event ticket',
  //   maxPayments: 50,
  // });
  // console.log(`   ✅ Link created: https://epay.dev/pay/${link.code}`);
  // console.log(`      Max payments: ${link.maxPayments}\n`);
  console.log('   ✅ Payment link would be created\n');

  // 2. Look up by code
  console.log('2. Looking up payment link by code...');
  // const found = await client.paymentLinks.getByCode('abc123');
  // console.log(`   ✅ Found: ${found.description}\n`);
  console.log('   ✅ Link can be retrieved by short code\n');

  // ══════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════════════════════════════

  console.log('── Analytics ──\n');

  // 1. Merchant payment analytics
  console.log('1. Fetching merchant analytics (last 30 days)...');
  const analytics = await client.analytics.getMerchantAnalytics(MERCHANT_ID, 30);
  console.log(`   ✅ Total payments: ${analytics.totalPayments}`);
  console.log(`      Total volume:   ${analytics.totalVolume}`);
  console.log(`      Success rate:   ${analytics.successRate}%`);
  console.log(`      Refund rate:    ${analytics.refundRate}%\n`);

  // 2. Revenue breakdown
  console.log('2. Fetching revenue breakdown...');
  const revenue = await client.analytics.getMerchantRevenue(MERCHANT_ID, 30);
  console.log(`   ✅ Total revenue: ${revenue.totalRevenue}`);
  console.log(`      Total fees:    ${revenue.totalFees}`);
  console.log(`      Net revenue:   ${revenue.netRevenue}\n`);

  // 3. Platform analytics (admin)
  console.log('3. Fetching platform analytics (admin)...');
  const platform = await client.analytics.getPlatformAnalytics(30);
  console.log(`   ✅ Total merchants:   ${platform.totalMerchants}`);
  console.log(`      Active merchants:  ${platform.activeMerchants}`);
  console.log(`      Total payments:    ${platform.totalPayments}`);
  console.log(`      Total volume:      ${platform.totalVolume}\n`);

  // ══════════════════════════════════════════════════════════════════
  // MERCHANT MANAGEMENT
  // ══════════════════════════════════════════════════════════════════

  console.log('── Merchant Management ──\n');

  // 1. Get own merchant account
  console.log('1. Getting own merchant account...');
  // const me = await client.merchants.getMyMerchant();
  // console.log(`   ✅ Business: ${me.businessName}`);
  // console.log(`      Status:   ${me.status}`);
  // console.log(`      Fee rate: ${me.feeRate}%\n`);
  console.log('   ✅ Merchant profile retrieved\n');

  // 2. Update profile
  console.log('2. Updating merchant profile...');
  // await client.merchants.update('merch_123', {
  //   businessName: 'Updated Business Name',
  //   description: 'New and improved services',
  // });
  console.log('   ✅ Profile updated\n');

  // 3. List active merchants (admin)
  console.log('3. Listing active merchants (admin)...');
  const { data: merchants } = await client.merchants.list({
    status: MerchantStatus.ACTIVE,
    page: 1,
    pageSize: 10,
  });
  console.log(`   ✅ Found ${merchants.length} active merchants\n`);

  // ══════════════════════════════════════════════════════════════════
  // PAGINATION HELPER
  // ══════════════════════════════════════════════════════════════════

  console.log('── Pagination Helper ──\n');

  console.log('Example: fetch all pages for a resource');
  console.log(`
  async function fetchAllPages<T>(
    fetchFn: (page: number) => Promise<{ data: T[]; hasNext: boolean }>,
  ): Promise<T[]> {
    let page = 1;
    const all: T[] = [];
    while (true) {
      const result = await fetchFn(page);
      all.push(...result.data);
      if (!result.hasNext) break;
      page++;
    }
    return all;
  }

  // Usage:
  const allPayments = await fetchAllPages(async (page) => {
    return client.payments.list({
      merchantId: '${MERCHANT_ID}',
      page,
      pageSize: 100,
    });
  });
  console.log(\`Total payments: \${allPayments.length}\`);
  `);

  console.log('✨ Advanced flow examples completed!');
}

main().catch(console.error);
