// EPay Core Type Definitions — Stellar Network
// ============================================================================

// ── Enums ───────────────────────────────────────────────────────────────────

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum EscrowStatus {
  CREATED = 'CREATED',
  FUNDED = 'FUNDED',
  IN_PROGRESS = 'IN_PROGRESS',
  MILESTONE_RELEASED = 'MILESTONE_RELEASED',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum RefundStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  TRIAL = 'TRIAL',
}

export enum SubscriptionBillingInterval {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

export enum MerchantStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE',
}

export enum MerchantVerificationLevel {
  NONE = 'NONE',
  BASIC = 'BASIC',
  VERIFIED = 'VERIFIED',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum WebhookEventType {
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_CONFIRMED = 'payment.confirmed',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_OVERDUE = 'invoice.overdue',
  REFUND_REQUESTED = 'refund.requested',
  REFUND_COMPLETED = 'refund.completed',
  ESCROW_CREATED = 'escrow.created',
  ESCROW_FUNDED = 'escrow.funded',
  ESCROW_COMPLETED = 'escrow.completed',
  ESCROW_DISPUTED = 'escrow.disputed',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_PAYMENT_FAILED = 'subscription.payment_failed',
  SETTLEMENT_PROCESSED = 'settlement.processed',
  MERCHANT_VERIFIED = 'merchant.verified',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MERCHANT = 'MERCHANT',
  CUSTOMER = 'CUSTOMER',
  DEVELOPER = 'DEVELOPER',
}

export enum StellarNetwork {
  PUBLIC = 'public',
  TESTNET = 'testnet',
  FUTURENET = 'futurenet',
  SANDBOX = 'sandbox',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  WEBHOOK = 'WEBHOOK',
  IN_APP = 'IN_APP',
}

// ── Stellar Asset ───────────────────────────────────────────────────────────

export interface StellarAsset {
  code: string;
  issuer: string;
  type: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
}

export interface AssetBalance {
  asset: StellarAsset;
  balance: string;
  limit: string;
  buyingLiabilities: string;
  sellingLiabilities: string;
  isAuthorized: boolean;
}

export interface Trustline {
  asset: StellarAsset;
  account: string;
  limit: string;
  balance: string;
  isAuthorized: boolean;
  createdAt: Date;
}

// ── User & Auth ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  stellarPublicKey: string | null;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletAuth {
  publicKey: string;
  signature: string;
  message: string;
  network: StellarNetwork;
  walletProvider: WalletProvider;
}

export type WalletProvider = 'freighter' | 'xbull' | 'albedo' | 'rabet' | 'lobstr';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

// ── Merchant ────────────────────────────────────────────────────────────────

export interface Merchant {
  id: string;
  userId: string;
  businessName: string;
  businessEmail: string;
  businessUrl: string | null;
  description: string | null;
  status: MerchantStatus;
  verificationLevel: MerchantVerificationLevel;
  supportedAssets: StellarAsset[];
  feeRate: number;
  settlementPublicKey: string | null;
  webhookUrl: string | null;
  apiKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MerchantOnboardingRequest {
  businessName: string;
  businessEmail: string;
  businessUrl?: string;
  description?: string;
  supportedAssets: StellarAsset[];
  settlementPublicKey: string;
}

export interface MerchantOnboardingResponse {
  merchantId: string;
  status: MerchantStatus;
  apiKey: string;
}

// ── Payment ─────────────────────────────────────────────────────────────────

export interface Payment {
  id: string;
  paymentId: string;
  merchantId: string;
  customerId: string | null;
  amount: string;
  asset: StellarAsset;
  status: PaymentStatus;
  description: string | null;
  payerPublicKey: string | null;
  recipientPublicKey: string;
  memo: string | null;
  txHash: string | null;
  ledgerSequence: number | null;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentRequest {
  merchantId: string;
  amount: string;
  asset: StellarAsset;
  description?: string;
  payerPublicKey?: string;
  recipientPublicKey: string;
  memo?: string;
  expiresIn?: number;
  metadata?: Record<string, unknown>;
}

export interface BatchPaymentRequest {
  payments: CreatePaymentRequest[];
  idempotencyKey: string;
}

export interface SplitPaymentRequest {
  merchantId: string;
  totalAmount: string;
  asset: StellarAsset;
  recipients: SplitPaymentRecipient[];
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface SplitPaymentRecipient {
  publicKey: string;
  amount: string;
  percentage?: number;
}

export interface PaymentLink {
  id: string;
  merchantId: string;
  url: string;
  code: string;
  amount: string;
  asset: StellarAsset;
  description: string | null;
  maxPayments: number | null;
  currentPayments: number;
  expiresAt: Date | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentLinkRequest {
  amount: string;
  asset: StellarAsset;
  description?: string;
  maxPayments?: number;
  expiresIn?: number;
  metadata?: Record<string, unknown>;
}

// ── Invoice ─────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoiceNumber: string;
  merchantId: string;
  customerId: string | null;
  amount: string;
  asset: StellarAsset;
  status: InvoiceStatus;
  items: InvoiceItem[];
  dueDate: Date;
  paidAmount: string | null;
  paidAt: Date | null;
  paymentId: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface CreateInvoiceRequest {
  merchantId: string;
  amount: string;
  asset: StellarAsset;
  items: InvoiceItem[];
  dueDate?: Date;
  customerId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

// ── Escrow ──────────────────────────────────────────────────────────────────

export interface Escrow {
  id: string;
  escrowId: string;
  merchantId: string;
  customerId: string;
  amount: string;
  asset: StellarAsset;
  status: EscrowStatus;
  milestones: Milestone[];
  currentMilestone: number;
  contractAddress: string;
  txHash: string | null;
  disputedAt: Date | null;
  resolvedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Milestone {
  index: number;
  description: string;
  amount: string;
  status: MilestoneStatus;
  completedAt: Date | null;
  releasedAt: Date | null;
  releaseTxHash: string | null;
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  RELEASED = 'RELEASED',
}

export interface CreateEscrowRequest {
  merchantId: string;
  customerId: string;
  amount: string;
  asset: StellarAsset;
  milestones: Omit<Milestone, 'status' | 'completedAt' | 'releasedAt' | 'releaseTxHash'>[];
  metadata?: Record<string, unknown>;
}

// ── Refund ──────────────────────────────────────────────────────────────────

export interface Refund {
  id: string;
  refundId: string;
  paymentId: string;
  merchantId: string;
  amount: string;
  originalAmount: string;
  asset: StellarAsset;
  status: RefundStatus;
  reason: string;
  isPartial: boolean;
  txHash: string | null;
  processedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRefundRequest {
  paymentId: string;
  amount: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

// ── Subscription ────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  subscriptionId: string;
  merchantId: string;
  customerId: string;
  planName: string;
  amount: string;
  asset: StellarAsset;
  interval: SubscriptionBillingInterval;
  status: SubscriptionStatus;
  trialEndDate: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  maxPayments: number | null;
  paymentsMade: number;
  lastPaymentId: string | null;
  cancelledAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionRequest {
  merchantId: string;
  customerId: string;
  planName: string;
  amount: string;
  asset: StellarAsset;
  interval: SubscriptionBillingInterval;
  trialDays?: number;
  maxPayments?: number;
  metadata?: Record<string, unknown>;
}

// ── Settlement ──────────────────────────────────────────────────────────────

export interface Settlement {
  id: string;
  settlementId: string;
  merchantId: string;
  amount: string;
  asset: StellarAsset;
  feeAmount: string;
  netAmount: string;
  status: SettlementStatus;
  paymentIds: string[];
  txHash: string | null;
  settlementPublicKey: string;
  periodStart: Date;
  periodEnd: Date;
  processedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ── Treasury ────────────────────────────────────────────────────────────────

export interface TreasuryTransaction {
  id: string;
  txType: TreasuryTxType;
  amount: string;
  asset: StellarAsset;
  fromPublicKey: string | null;
  toPublicKey: string | null;
  txHash: string | null;
  status: TreasuryTxStatus;
  referenceId: string | null;
  referenceType: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export enum TreasuryTxType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  FEE_COLLECTION = 'FEE_COLLECTION',
  SETTLEMENT = 'SETTLEMENT',
  REFUND = 'REFUND',
  ESCROW_HOLD = 'ESCROW_HOLD',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
}

export enum TreasuryTxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ── Notification ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  isRead: boolean;
  link: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ── Webhook ─────────────────────────────────────────────────────────────────

export interface WebhookDelivery {
  id: string;
  merchantId: string;
  eventType: WebhookEventType;
  url: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  response: string | null;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: Date | null;
  succeededAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
}

// ── API ─────────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  merchantId: string;
  key: string;
  name: string;
  permissions: ApiPermission[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export enum ApiPermission {
  READ_PAYMENTS = 'read:payments',
  WRITE_PAYMENTS = 'write:payments',
  READ_INVOICES = 'read:invoices',
  WRITE_INVOICES = 'write:invoices',
  READ_REFUNDS = 'read:refunds',
  WRITE_REFUNDS = 'write:refunds',
  READ_SUBSCRIPTIONS = 'read:subscriptions',
  WRITE_SUBSCRIPTIONS = 'write:subscriptions',
  READ_ESCROW = 'read:escrow',
  WRITE_ESCROW = 'write:escrow',
  READ_SETTLEMENTS = 'read:settlements',
  READ_ANALYTICS = 'read:analytics',
  ADMIN = 'admin',
}

// ── Analytics ───────────────────────────────────────────────────────────────

export interface PaymentAnalytics {
  totalPayments: number;
  totalVolume: string;
  averagePaymentSize: string;
  successRate: number;
  refundRate: number;
  assetBreakdown: Record<string, number>;
  dailyVolume: DailyVolume[];
}

export interface DailyVolume {
  date: string;
  amount: string;
  count: number;
}

// ── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ApiError[];
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
