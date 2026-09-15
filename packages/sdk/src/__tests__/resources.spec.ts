import { MerchantStatus, PaymentStatus, SubscriptionBillingInterval } from '@epay/types';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EPayClient } from '../client';

const XLM_ASSET = { code: 'XLM', issuer: 'native', type: 'native' as const };

function mockClient() {
  const client = new EPayClient({ apiUrl: 'https://api.epay.dev' });
  client.get = vi.fn() as any;
  client.post = vi.fn() as any;
  client.patch = vi.fn() as any;
  client.put = vi.fn() as any;
  client.delete = vi.fn() as any;
  return client;
}

describe('Resource Modules', () => {
  let client: ReturnType<typeof mockClient>;

  beforeEach(() => {
    client = mockClient();
  });

  describe('PaymentsResource', () => {
    it('create should POST to /payments', async () => {
      (client.post as any).mockResolvedValue({ paymentId: 'pay_1', amount: '1000000' });
      const result = await client.payments.create({
        merchantId: 'merch_1',
        amount: '1000000',
        asset: XLM_ASSET,
        recipientPublicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
      });
      expect(result.paymentId).toBe('pay_1');
      expect(client.post).toHaveBeenCalledWith('/payments', expect.any(Object));
    });

    it('getById should GET /payments/:id', async () => {
      (client.get as any).mockResolvedValue({ id: 'pay_1' });
      const result = await client.payments.getById('pay_1');
      expect(result.id).toBe('pay_1');
      expect(client.get).toHaveBeenCalledWith('/payments/pay_1');
    });

    it('list should GET /payments with query', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.payments.list({ page: 1, pageSize: 10, status: PaymentStatus.COMPLETED });
      expect(client.get).toHaveBeenCalledWith(expect.stringContaining('status=COMPLETED'));
    });

    it('confirm should PATCH /payments/:id/confirm', async () => {
      (client.patch as any).mockResolvedValue({ status: 'CONFIRMED' });
      const result = await client.payments.confirm('pay_1', '0xtx');
      expect(result.status).toBe('CONFIRMED');
      expect(client.patch).toHaveBeenCalledWith('/payments/pay_1/confirm', { txHash: '0xtx' });
    });

    it('complete should PATCH /payments/:id/complete', async () => {
      (client.patch as any).mockResolvedValue({ status: 'COMPLETED' });
      const result = await client.payments.complete('pay_1');
      expect(result.status).toBe('COMPLETED');
    });

    it('fail should PATCH /payments/:id/fail', async () => {
      (client.patch as any).mockResolvedValue({ status: 'FAILED' });
      const result = await client.payments.fail('pay_1');
      expect(result.status).toBe('FAILED');
    });

    it('cancel should PATCH /payments/:id/cancel', async () => {
      (client.patch as any).mockResolvedValue({ status: 'CANCELLED' });
      const result = await client.payments.cancel('pay_1');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('InvoicesResource', () => {
    it('create should POST to /invoices', async () => {
      (client.post as any).mockResolvedValue({ invoiceNumber: 'INV-1', amount: '5000000000' });
      const result = await client.invoices.create({
        merchantId: 'merch_1',
        amount: '5000000000',
        asset: XLM_ASSET,
        items: [{ description: 'Item', quantity: 1, unitPrice: '5000000000', total: '5000000000' }],
      });
      expect(result.invoiceNumber).toBe('INV-1');
    });

    it('issue should PATCH /invoices/:id/issue', async () => {
      (client.patch as any).mockResolvedValue({ status: 'ISSUED' });
      const result = await client.invoices.issue('inv_1');
      expect(result.status).toBe('ISSUED');
    });

    it('markPaid should PATCH with paymentId', async () => {
      (client.patch as any).mockResolvedValue({ status: 'PAID' });
      const result = await client.invoices.markPaid('inv_1', 'pay_1');
      expect(result.status).toBe('PAID');
      expect(client.patch).toHaveBeenCalledWith('/invoices/inv_1/mark-paid', {
        paymentId: 'pay_1',
      });
    });

    it('cancel should PATCH /invoices/:id/cancel', async () => {
      (client.patch as any).mockResolvedValue({ status: 'CANCELLED' });
      const result = await client.invoices.cancel('inv_1');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('EscrowsResource', () => {
    it('create should POST to /escrows', async () => {
      (client.post as any).mockResolvedValue({ escrowId: 'esc_1' });
      const result = await client.escrows.create({
        merchantId: 'merch_1',
        customerId: 'cust_1',
        amount: '1000000000',
        asset: XLM_ASSET,
        milestones: [{ index: 0, description: 'Milestone 1', amount: '1000000000' }],
      });
      expect(result.escrowId).toBe('esc_1');
    });

    it('fund should PATCH /escrows/:id/fund', async () => {
      (client.patch as any).mockResolvedValue({ status: 'FUNDED' });
      const result = await client.escrows.fund('esc_1', '0xfund');
      expect(result.status).toBe('FUNDED');
    });

    it('completeMilestone should PATCH with milestone index', async () => {
      (client.patch as any).mockResolvedValue({ status: 'IN_PROGRESS' });
      const result = await client.escrows.completeMilestone('esc_1', 1, '0xrel');
      expect(result.status).toBe('IN_PROGRESS');
      expect(client.patch).toHaveBeenCalledWith('/escrows/esc_1/milestones/1/complete', {
        releaseTxHash: '0xrel',
      });
    });

    it('dispute should PATCH /escrows/:id/dispute', async () => {
      (client.patch as any).mockResolvedValue({ status: 'DISPUTED' });
      const result = await client.escrows.dispute('esc_1');
      expect(result.status).toBe('DISPUTED');
    });

    it('resolve should PATCH /escrows/:id/resolve', async () => {
      (client.patch as any).mockResolvedValue({ status: 'RESOLVED' });
      const result = await client.escrows.resolve('esc_1');
      expect(result.status).toBe('RESOLVED');
    });

    it('cancel should PATCH /escrows/:id/cancel', async () => {
      (client.patch as any).mockResolvedValue({ status: 'CANCELLED' });
      const result = await client.escrows.cancel('esc_1');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('RefundsResource', () => {
    it('request should POST to /refunds', async () => {
      (client.post as any).mockResolvedValue({ refundId: 'ref_1', status: 'REQUESTED' });
      const result = await client.refunds.request({
        paymentId: 'pay_1',
        amount: '500000000',
        reason: 'Customer request',
      });
      expect(result.status).toBe('REQUESTED');
    });

    it('approve should PATCH /refunds/:id/approve', async () => {
      (client.patch as any).mockResolvedValue({ status: 'APPROVED' });
      const result = await client.refunds.approve('ref_1');
      expect(result.status).toBe('APPROVED');
    });

    it('process should PATCH with txHash', async () => {
      (client.patch as any).mockResolvedValue({ status: 'COMPLETED' });
      const result = await client.refunds.process('ref_1', '0xproc');
      expect(result.status).toBe('COMPLETED');
    });

    it('reject should PATCH /refunds/:id/reject', async () => {
      (client.patch as any).mockResolvedValue({ status: 'REJECTED' });
      const result = await client.refunds.reject('ref_1');
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('SubscriptionsResource', () => {
    it('create should POST to /subscriptions', async () => {
      (client.post as any).mockResolvedValue({ subscriptionId: 'sub_1' });
      const result = await client.subscriptions.create({
        merchantId: 'merch_1',
        customerId: 'cust_1',
        planName: 'Premium',
        amount: '1000000000',
        asset: XLM_ASSET,
        interval: SubscriptionBillingInterval.MONTHLY,
      });
      expect(result.subscriptionId).toBe('sub_1');
    });

    it('pause should PATCH /subscriptions/:id/pause', async () => {
      (client.patch as any).mockResolvedValue({ status: 'PAUSED' });
      const result = await client.subscriptions.pause('sub_1');
      expect(result.status).toBe('PAUSED');
    });

    it('resume should PATCH /subscriptions/:id/resume', async () => {
      (client.patch as any).mockResolvedValue({ status: 'ACTIVE' });
      const result = await client.subscriptions.resume('sub_1');
      expect(result.status).toBe('ACTIVE');
    });

    it('cancel should PATCH /subscriptions/:id/cancel', async () => {
      (client.patch as any).mockResolvedValue({ status: 'CANCELLED' });
      const result = await client.subscriptions.cancel('sub_1');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('MerchantsResource', () => {
    it('register should POST to /merchants', async () => {
      (client.post as any).mockResolvedValue({ id: 'merch_1', businessName: 'Store' });
      const result = await client.merchants.register({
        businessName: 'Store',
        businessEmail: 'm@store.com',
        supportedAssets: [XLM_ASSET],
        settlementPublicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
      });
      expect(result.businessName).toBe('Store');
    });

    it('getMyMerchant should GET /merchants/me', async () => {
      (client.get as any).mockResolvedValue({ id: 'merch_1' });
      const result = await client.merchants.getMyMerchant();
      expect(result.id).toBe('merch_1');
      expect(client.get).toHaveBeenCalledWith('/merchants/me');
    });

    it('list should GET /merchants with query', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.merchants.list({ status: MerchantStatus.ACTIVE });
      expect(client.get).toHaveBeenCalledWith(expect.stringContaining('status=ACTIVE'));
    });

    it('verify should PATCH /merchants/:id/verify', async () => {
      (client.patch as any).mockResolvedValue({ status: 'ACTIVE', verificationLevel: 'VERIFIED' });
      const result = await client.merchants.verify('merch_1', true, 'VERIFIED');
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('SettlementsResource', () => {
    it('create should POST to /settlements', async () => {
      (client.post as any).mockResolvedValue({ settlementId: 'set_1', netAmount: '995000000' });
      const result = await client.settlements.create('merch_1');
      expect(result.settlementId).toBe('set_1');
    });

    it('process should PATCH with txHash and publicKey', async () => {
      (client.patch as any).mockResolvedValue({ status: 'COMPLETED' });
      const result = await client.settlements.process(
        'set_1',
        '0xsettle',
        'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
      );
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('PaymentLinksResource', () => {
    it('create should POST to /payment-links', async () => {
      (client.post as any).mockResolvedValue({
        code: 'test123',
        url: 'https://epay.dev/pay/test123',
      });
      const result = await client.paymentLinks.create({
        merchantId: 'merch_1',
        amount: '1000',
        asset: XLM_ASSET,
      });
      expect(result.code).toBe('test123');
    });

    it('getByCode should GET /payment-links/by-code/:code', async () => {
      (client.get as any).mockResolvedValue({ code: 'abc', amount: '1000' });
      const result = await client.paymentLinks.getByCode('abc');
      expect(result.code).toBe('abc');
      expect(client.get).toHaveBeenCalledWith('/payment-links/by-code/abc');
    });
  });

  describe('AnalyticsResource', () => {
    it('getMerchantAnalytics should GET with optional days', async () => {
      (client.get as any).mockResolvedValue({ totalPayments: 100, totalVolume: '5000' });
      const result = await client.analytics.getMerchantAnalytics('merch_1', 30);
      expect(result.totalPayments).toBe(100);
      expect(client.get).toHaveBeenCalledWith('/analytics/merchant/merch_1?days=30');
    });

    it('getPlatformAnalytics should GET platform', async () => {
      (client.get as any).mockResolvedValue({ totalMerchants: 10 });
      const result = await client.analytics.getPlatformAnalytics();
      expect(result.totalMerchants).toBe(10);
      expect(client.get).toHaveBeenCalledWith('/analytics/platform');
    });

    it('getPlatformAnalytics should include the window when one is given', async () => {
      (client.get as any).mockResolvedValue({ totalMerchants: 10 });
      await client.analytics.getPlatformAnalytics(7);
      expect(client.get).toHaveBeenCalledWith('/analytics/platform?days=7');
    });

    it('getMerchantRevenue should GET the revenue breakdown', async () => {
      (client.get as any).mockResolvedValue({
        totalRevenue: '1000',
        totalFees: '5',
        netRevenue: '995',
        daily: [],
      });
      const result = await client.analytics.getMerchantRevenue('merch_1', 30);
      expect(result.netRevenue).toBe('995');
      expect(client.get).toHaveBeenCalledWith('/analytics/merchant/merch_1/revenue?days=30');
    });

    it('getMerchantRevenue should omit the window when none is given', async () => {
      (client.get as any).mockResolvedValue({ netRevenue: '0', daily: [] });
      await client.analytics.getMerchantRevenue('merch_1');
      expect(client.get).toHaveBeenCalledWith('/analytics/merchant/merch_1/revenue');
    });
  });

  /**
   * The suites above cover the state-changing calls. These cover the read and
   * list methods (and `update`), which are the other half of the published
   * surface — an SDK method that is never exercised is a method whose URL and
   * query encoding can silently rot.
   */
  describe('read and list methods', () => {
    it('refunds.getById should GET /refunds/:id', async () => {
      (client.get as any).mockResolvedValue({ refundId: 'ref_1' });
      const result = await client.refunds.getById('ref_1');
      expect(result.refundId).toBe('ref_1');
      expect(client.get).toHaveBeenCalledWith('/refunds/ref_1');
    });

    it('refunds.list should encode its filters', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.refunds.list({ merchantId: 'merch_1', paymentId: 'pay_1' });
      expect(client.get).toHaveBeenCalledWith('/refunds?merchantId=merch_1&paymentId=pay_1');
    });

    it('invoices.getById should GET /invoices/:id', async () => {
      (client.get as any).mockResolvedValue({ invoiceNumber: 'INV-1' });
      const result = await client.invoices.getById('inv_1');
      expect(result.invoiceNumber).toBe('INV-1');
      expect(client.get).toHaveBeenCalledWith('/invoices/inv_1');
    });

    it('invoices.list should GET /invoices with no trailing `?` when unfiltered', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.invoices.list();
      expect(client.get).toHaveBeenCalledWith('/invoices');
    });

    it('invoices.list should drop filters that are explicitly undefined', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.invoices.list({ page: 2, merchantId: undefined });
      expect(client.get).toHaveBeenCalledWith('/invoices?page=2');
    });

    it('escrows.getById should GET /escrows/:id', async () => {
      (client.get as any).mockResolvedValue({ escrowId: 'esc_1' });
      const result = await client.escrows.getById('esc_1');
      expect(result.escrowId).toBe('esc_1');
      expect(client.get).toHaveBeenCalledWith('/escrows/esc_1');
    });

    it('escrows.list should GET /escrows with filters', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.escrows.list({ customerId: 'cust_1' });
      expect(client.get).toHaveBeenCalledWith('/escrows?customerId=cust_1');
    });

    it('merchants.getById should GET /merchants/:id', async () => {
      (client.get as any).mockResolvedValue({ id: 'merch_1' });
      const result = await client.merchants.getById('merch_1');
      expect(result.id).toBe('merch_1');
      expect(client.get).toHaveBeenCalledWith('/merchants/merch_1');
    });

    it('merchants.list should GET /merchants with no filters', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.merchants.list();
      expect(client.get).toHaveBeenCalledWith('/merchants');
    });

    it('merchants.update should PUT the partial payload', async () => {
      (client.put as any).mockResolvedValue({ id: 'merch_1', businessName: 'Renamed' });
      const result = await client.merchants.update('merch_1', { businessName: 'Renamed' });
      expect(result.businessName).toBe('Renamed');
      expect(client.put).toHaveBeenCalledWith('/merchants/merch_1', { businessName: 'Renamed' });
    });

    it('paymentLinks.listByMerchant should GET the merchant-scoped collection', async () => {
      (client.get as any).mockResolvedValue([{ code: 'abc' }]);
      const result = await client.paymentLinks.listByMerchant('merch_1');
      expect(result).toHaveLength(1);
      expect(client.get).toHaveBeenCalledWith('/payment-links/merchant/merch_1');
    });

    it('subscriptions.getById should GET /subscriptions/:id', async () => {
      (client.get as any).mockResolvedValue({ subscriptionId: 'sub_1' });
      const result = await client.subscriptions.getById('sub_1');
      expect(result.subscriptionId).toBe('sub_1');
      expect(client.get).toHaveBeenCalledWith('/subscriptions/sub_1');
    });

    it('subscriptions.list should GET /subscriptions with filters', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.subscriptions.list({ customerId: 'cust_1' });
      expect(client.get).toHaveBeenCalledWith('/subscriptions?customerId=cust_1');
    });

    it('settlements.getById should GET /settlements/:id', async () => {
      (client.get as any).mockResolvedValue({ settlementId: 'set_1' });
      const result = await client.settlements.getById('set_1');
      expect(result.settlementId).toBe('set_1');
      expect(client.get).toHaveBeenCalledWith('/settlements/set_1');
    });

    it('settlements.list should GET /settlements with filters', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.settlements.list({ merchantId: 'merch_1' });
      expect(client.get).toHaveBeenCalledWith('/settlements?merchantId=merch_1');
    });

    it('payments.list should drop null filters as well as undefined ones', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.payments.list({ page: 1, pageSize: null as unknown as number });
      expect(client.get).toHaveBeenCalledWith('/payments?page=1');
    });

    it('encodes query values rather than pasting them in raw', async () => {
      (client.get as any).mockResolvedValue({ data: [], total: 0 });
      await client.payments.list({ merchantId: 'merch 1&admin=true' });
      expect(client.get).toHaveBeenCalledWith('/payments?merchantId=merch%201%26admin%3Dtrue');
    });
  });
});
