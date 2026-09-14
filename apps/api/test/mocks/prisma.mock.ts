/**
 * A Prisma delegate (e.g. `prisma.payment`) whose every method is a Jest mock.
 *
 * The return type is deliberately `jest.Mock` rather than
 * `jest.MockedFunction<...>`: the specs resolve arbitrary fixtures through these
 * calls, and reproducing Prisma's generic `SelectSubset<T, Args>` signatures
 * would force a cast at every call site for no type-safety gain.
 */
export interface MockPrismaDelegate {
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  findFirst: jest.Mock;
  findFirstOrThrow: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
}

/**
 * The mocked `PrismaService` handed to `Test.createTestingModule`.
 *
 * This used to be `jest.Mocked<PrismaService>`, which does **not** work: Prisma
 * exposes its models as getters returning delegate classes, and `jest.Mocked`
 * only rewrites function-valued keys at the top level. The delegate methods kept
 * their real Prisma signatures, so `prisma.payment.findMany.mockResolvedValue(…)`
 * was 180+ `TS2339` errors the moment the specs were brought into a compiler
 * program — which is exactly why they had never been type-checked.
 */
export interface MockPrismaService {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $on: jest.Mock;
  $transaction: jest.Mock;
  $use: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  user: MockPrismaDelegate;
  merchant: MockPrismaDelegate;
  wallet: MockPrismaDelegate;
  trustline: MockPrismaDelegate;
  payment: MockPrismaDelegate;
  paymentLink: MockPrismaDelegate;
  invoice: MockPrismaDelegate;
  invoiceItem: MockPrismaDelegate;
  escrow: MockPrismaDelegate;
  milestone: MockPrismaDelegate;
  refund: MockPrismaDelegate;
  subscription: MockPrismaDelegate;
  subscriptionPayment: MockPrismaDelegate;
  settlement: MockPrismaDelegate;
  treasuryTransaction: MockPrismaDelegate;
  notification: MockPrismaDelegate;
  webhookDelivery: MockPrismaDelegate;
  apiKey: MockPrismaDelegate;
  auditLog: MockPrismaDelegate;
  analyticsSnapshot: MockPrismaDelegate;
  idempotencyKey: MockPrismaDelegate;
}

export function mockDate(date = '2026-08-05T12:00:00.000Z'): Date {
  return new Date(date);
}

export function createMockDelegate(): MockPrismaDelegate {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

export function createMockPrismaService(): MockPrismaService {
  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
    $transaction: jest.fn(),
    $use: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    user: createMockDelegate(),
    merchant: createMockDelegate(),
    wallet: createMockDelegate(),
    trustline: createMockDelegate(),
    payment: createMockDelegate(),
    paymentLink: createMockDelegate(),
    invoice: createMockDelegate(),
    invoiceItem: createMockDelegate(),
    escrow: createMockDelegate(),
    milestone: createMockDelegate(),
    refund: createMockDelegate(),
    subscription: createMockDelegate(),
    subscriptionPayment: createMockDelegate(),
    settlement: createMockDelegate(),
    treasuryTransaction: createMockDelegate(),
    notification: createMockDelegate(),
    webhookDelivery: createMockDelegate(),
    apiKey: createMockDelegate(),
    auditLog: createMockDelegate(),
    analyticsSnapshot: createMockDelegate(),
    idempotencyKey: createMockDelegate(),
  };
}
