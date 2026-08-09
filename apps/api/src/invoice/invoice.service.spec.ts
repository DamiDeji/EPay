import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockInvoice = {
    id: 'inv_1',
    invoiceNumber: 'INV-TEST123',
    merchantId: 'merch_1',
    customerId: 'cust_1',
    amount: BigInt(5000000000),
    currency: 'XLM',
    status: 'DRAFT',
    dueDate: new Date('2026-09-05'),
    paidAmount: null,
    paidAt: null,
    paymentId: null,
    notes: 'Test invoice',
    metadata: {},
    createdAt: mockDate(),
    updatedAt: mockDate(),
    items: [{ id: 'item_1', invoiceId: 'inv_1', description: 'Item', quantity: 1, unitPrice: BigInt(5000000000), total: BigInt(5000000000) }],
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvoiceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<InvoiceService>(InvoiceService);
  });

  describe('create', () => {
    it('should create an invoice', async () => {
      prisma.invoice.create.mockResolvedValue(mockInvoice);
      const result = await service.create({
        merchantId: 'merch_1',
        currency: 'XLM',
        items: [{ description: 'Item', quantity: 1, unitPrice: '5000000000' }],
      });
      expect(result.invoiceNumber).toMatch(/^INV-/);
      expect(prisma.invoice.create).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return invoice with items', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      const result = await service.getById('inv_1');
      expect(result?.id).toBe('inv_1');
      expect(result?.items).toHaveLength(1);
    });
  });

  describe('issue', () => {
    it('should issue a draft invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'ISSUED' });
      const result = await service.issue('inv_1');
      expect(result.status).toBe('ISSUED');
    });

    it('should throw if not draft', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...mockInvoice, status: 'PAID' });
      await expect(service.issue('inv_1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markPaid', () => {
    it('should mark issued invoice as paid', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...mockInvoice, status: 'ISSUED' });
      prisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'PAID', paymentId: 'pay_1' });
      const result = await service.markPaid('inv_1', 'pay_1');
      expect(result.status).toBe('PAID');
    });
  });

  describe('cancel', () => {
    it('should cancel a draft invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'CANCELLED' });
      const result = await service.cancel('inv_1');
      expect(result.status).toBe('CANCELLED');
    });
  });
});
