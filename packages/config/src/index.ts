import { z } from 'zod';

// ── Environment Schema ──────────────────────────────────────────────────────

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // TON
  TON_NETWORK: z.enum(['mainnet', 'testnet']).default('testnet'),
  TON_ENDPOINT: z.string().url().default('https://toncenter.com/api/v2/jsonRPC'),
  TON_API_KEY: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Rate Limiting
  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Contracts
  PAYMENT_ROUTER_ADDRESS: z.string().optional(),
  MERCHANT_REGISTRY_ADDRESS: z.string().optional(),
  INVOICE_MANAGER_ADDRESS: z.string().optional(),
  ESCROW_MANAGER_ADDRESS: z.string().optional(),
  SUBSCRIPTION_MANAGER_ADDRESS: z.string().optional(),
  REFUND_MANAGER_ADDRESS: z.string().optional(),
  TREASURY_VAULT_ADDRESS: z.string().optional(),
  FEE_MANAGER_ADDRESS: z.string().optional(),
  SETTLEMENT_MANAGER_ADDRESS: z.string().optional(),

  // Webhook
  WEBHOOK_SECRET: z.string().optional(),
  WEBHOOK_MAX_RETRIES: z.coerce.number().int().positive().default(5),
  WEBHOOK_RETRY_DELAY_MS: z.coerce.number().int().positive().default(5000),
});

export type EnvConfig = z.infer<typeof envSchema>;

// ── Config Loader ───────────────────────────────────────────────────────────

function loadEnv(): EnvConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }

  return parsed.data;
}

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!_config) {
    _config = loadEnv();
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const APP_NAME = 'EPay';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Decentralized Payment Gateway on TON';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const PAYMENT_EXPIRY_SECONDS = 3600; // 1 hour
export const INVOICE_DUE_DAYS = 30;
export const ESCROW_MAX_MILESTONES = 20;
export const REFUND_WINDOW_DAYS = 90;
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 7;

export const DEFAULT_FEE_BPS = 50; // 0.5%
export const MAX_FEE_BPS = 500; // 5%

export const TON_DECIMALS = 9;
export const TON_MIN_PAYMENT = '10000000'; // 0.01 TON in nanoTON

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 100;

export const WEBHOOK_TIMEOUT_MS = 10_000;
export const WEBHOOK_MAX_RETRIES = 5;
export const WEBHOOK_BACKOFF_MULTIPLIER = 2;

export const INDEXER_BATCH_SIZE = 100;
export const INDEXER_POLL_INTERVAL_MS = 10_000;
export const INDEXER_CONFIRMATION_BLOCKS = 20;
