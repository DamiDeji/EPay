// EPay TypeScript SDK — Main Exports
// =============================================================================

// Client
export { EPayClient } from './client';
export type { EPayClientConfig } from './client';

// Wallet
export { WalletClient } from './wallet';
export type { WalletConfig, WalletSignature } from './wallet';

// Utilities
export {
  nanoToTon,
  tonToNano,
  isValidTonAddress,
  formatAddress,
  getExplorerUrl,
  calculateFee,
  calculateNetAmount,
  EPayError,
} from './utils';

// Resources
export { PaymentsResource } from './resources/payments';
export { PaymentLinksResource } from './resources/payment-links';
export { InvoicesResource } from './resources/invoices';
export { EscrowsResource } from './resources/escrows';
export { RefundsResource } from './resources/refunds';
export { SubscriptionsResource } from './resources/subscriptions';
export { MerchantsResource } from './resources/merchants';
export { SettlementsResource } from './resources/settlements';
export { AnalyticsResource } from './resources/analytics';

// Re-export types for convenience
export type {
  Payment,
  CreatePaymentRequest,
  PaymentLink,
  CreatePaymentLinkRequest,
  Invoice,
  CreateInvoiceRequest,
  Escrow,
  CreateEscrowRequest,
  Refund,
  CreateRefundRequest,
  Subscription,
  CreateSubscriptionRequest,
  Merchant,
  MerchantOnboardingRequest,
  Settlement,
  PaymentAnalytics,
  PaginatedResponse,
  PaginationQuery,
  ApiResponse,
  WalletAuth,
  AuthTokens,
  User,
  TONNetwork,
  PaymentStatus,
  InvoiceStatus,
  EscrowStatus,
  RefundStatus,
  SubscriptionStatus,
  MilestoneStatus,
  MerchantStatus,
  SettlementStatus,
  TreasuryTxType,
  TreasuryTxStatus,
  ApiPermission,
  NotificationChannel,
} from '@epay/types';
