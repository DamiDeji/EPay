import type { ApiResponse, ApiError, PaginatedResponse, PaginationQuery } from '@epay/types';

/**
 * Create a standardized API success response
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a standardized API error response
 */
export function createErrorResponse(message: string, errors: ApiError[] = []): ApiResponse<null> {
  return {
    success: false,
    data: null,
    message,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a validation error
 */
export function formatValidationError(field: string, message: string): ApiError {
  return { code: 'VALIDATION_ERROR', message, field };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  query: PaginationQuery,
): PaginatedResponse<T> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * Generate a unique ID with prefix
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

/**
 * Format nanoTON amount to human-readable TON
 */
export function nanoTonToTon(nanoTon: string | bigint): string {
  const value = BigInt(nanoTon);
  const whole = value / BigInt(1_000_000_000);
  const fraction = value % BigInt(1_000_000_000);
  return `${whole}.${fraction.toString().padStart(9, '0')}`;
}

/**
 * Format TON amount to nanoTON
 */
export function tonToNanoTon(ton: string): bigint {
  const [whole = '0', fraction = '0'] = ton.split('.');
  const paddedFraction = (fraction ?? '0').padEnd(9, '0').substring(0, 9);
  return BigInt(whole) * BigInt(1_000_000_000) + BigInt(paddedFraction);
}

/**
 * Calculate fee amount in basis points
 */
export function calculateFee(amount: string, feeBps: number): string {
  const amountBigInt = BigInt(amount);
  const fee = (amountBigInt * BigInt(feeBps)) / BigInt(10_000);
  return fee.toString();
}

/**
 * Calculate net amount after fee
 */
export function calculateNetAmount(amount: string, feeBps: number): string {
  const amountBigInt = BigInt(amount);
  const fee = (amountBigInt * BigInt(feeBps)) / BigInt(10_000);
  return (amountBigInt - fee).toString();
}

/**
 * Check if a value is expired
 */
export function isExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    backoffMultiplier?: number;
    maxDelayMs?: number;
  } = {},
): Promise<T> {
  const {
    maxRetries = 5,
    initialDelayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 60_000,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxRetries) break;

      const delay = Math.min(initialDelayMs * backoffMultiplier ** attempt, maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Mask sensitive data
 */
export function maskAddress(address: string, visibleChars = 6): string {
  if (address.length <= visibleChars * 2) return '*'.repeat(address.length);
  return `${address.slice(0, visibleChars)}...${address.slice(-visibleChars)}`;
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generate a random nonce
 */
export function generateNonce(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
