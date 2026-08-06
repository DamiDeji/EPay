import {
  MerchantStatus,
  PaymentStatus,
  SubscriptionBillingInterval,
} from '@epay/types';
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
        merchantId: 'merch_1', amount: '1000000', asset: XLM_ASSET, recipientPublicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
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
        merchantId: 'merch_1', amount: '5000000000', asset: XLM_ASSET,
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
      expect(client.patch).toHaveBeenCalledWith('/invoices/inv_1/mark-paid', { paymentId: 'pay_1' });
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
        merchantId: 'merch_1', customerId: 'cust_1', amount: '1000000000', asset: XLM_ASSET,
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
      expect(client.patch).toHaveBeenCalledWith('/escrows/esc_1/milestones/1/complete', { releaseTxHash: '0xrel' });
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
        paymentId: 'pay_1', amount: '500000000', reason: 'Customer request',
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
        merchantId: 'merch_1', customerId: 'cust_1', planName: 'Premium',
        amount: '1000000000', asset: XLM_ASSET, interval: SubscriptionBillingInterval.MONTHLY,
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
        businessName: 'Store', businessEmail: 'm@store.com', supportedAssets: [XLM_ASSET], settlementPublicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
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
      const result = await client.settlements.process('set_1', '0xsettle', 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('PaymentLinksResource', () => {
    it('create should POST to /payment-links', async () => {
      (client.post as any).mockResolvedValue({ code: 'test123', url: 'https://epay.dev/pay/test123' });
      const result = await client.paymentLinks.create({
        merchantId: 'merch_1', amount: '1000', asset: XLM_ASSET,
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
  });
});
