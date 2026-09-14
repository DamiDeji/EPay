// EPay TypeScript SDK — Stellar Network
// =============================================================================

// Client
export { EPayClient } from './client';
export type { EPayClientConfig } from './client';

// Wallet
export { WalletClient } from './wallet';
export type { WalletConfig, WalletSignature } from './wallet';

// Utilities
export {
  stroopsToXlm,
  xlmToStroops,
  isValidStellarPublicKey,
  isValidStellarSecretKey,
  formatStellarAddress,
  getExplorerUrl,
  calculateFee,
  calculateNetAmount,
  EPayError,
  // Backward compatibility aliases
  formatAddress,
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

// Re-export the enums as *values*, not types.
//
// These were part of the `export type { … }` block below, which meant callers
// could never write `PaymentStatus.PENDING` — TypeScript rejects a type-only
// import used as a value (`TS1362`). Every example in this package's README and
// in `examples/` did exactly that, so none of them compiled.
export {
  ApiPermission,
  EscrowStatus,
  InvoiceStatus,
  MerchantStatus,
  MerchantVerificationLevel,
  MilestoneStatus,
  NotificationChannel,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
  StellarNetwork,
  SubscriptionBillingInterval,
  SubscriptionStatus,
  TreasuryTxStatus,
  TreasuryTxType,
  UserRole,
  WebhookEventType,
} from '@epay/types';

// Interfaces, aliases and shapes (no runtime value) stay type-only.
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
  StellarAsset,
  AssetBalance,
  Trustline,
  WalletProvider,
} from '@epay/types';
