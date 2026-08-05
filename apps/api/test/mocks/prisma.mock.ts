import type { PrismaService } from '../../src/database/prisma.service';

export function mockDate(date = '2026-08-05T12:00:00.000Z'): Date {
  return new Date(date);
}

export function createMockPrismaService(): jest.Mocked<PrismaService> {
  const mockModel = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  });

  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
    $transaction: jest.fn(),
    $use: jest.fn(),
    user: mockModel(),
    merchant: mockModel(),
    wallet: mockModel(),
    payment: mockModel(),
    paymentLink: mockModel(),
    invoice: mockModel(),
    invoiceItem: mockModel(),
    escrow: mockModel(),
    milestone: mockModel(),
    refund: mockModel(),
    subscription: mockModel(),
    subscriptionPayment: mockModel(),
    settlement: mockModel(),
    treasuryTransaction: mockModel(),
    notification: mockModel(),
    webhookDelivery: mockModel(),
    apiKey: mockModel(),
    auditLog: mockModel(),
    analyticsSnapshot: mockModel(),
    idempotencyKey: mockModel(),
  } as unknown as jest.Mocked<PrismaService>;
}
