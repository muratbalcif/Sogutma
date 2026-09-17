import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(16).required(),
  }),
  JWT_REFRESH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(16).required(),
  }),
  ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('30d'),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  ADMIN_EMAIL: Joi.string().email().allow('').optional(),
  ADMIN_PASSWORD: Joi.string().allow('').optional(),
  FIREBASE_PROJECT_ID: Joi.string().allow('').optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),
  CORS_ORIGINS: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  SITE_NAME: Joi.string().allow('').optional(),
  SITE_SUPPORT_EMAIL: Joi.string().allow('').optional(),
  SITE_SUPPORT_PHONE: Joi.string().allow('').optional(),
  SITE_ADDRESS: Joi.string().allow('').optional(),
  SITE_PRIVACY_URL: Joi.string().allow('').optional(),
  SITE_KVKK_URL: Joi.string().allow('').optional(),
  SITE_TERMS_URL: Joi.string().allow('').optional(),
  BANK_TRANSFER_BANK_NAME: Joi.string().allow('').optional(),
  BANK_TRANSFER_IBAN: Joi.string().allow('').optional(),
  BANK_TRANSFER_ACCOUNT_NAME: Joi.string().allow('').optional(),
  PAYMENT_EXPIRY_HOURS: Joi.number().integer().min(1).max(168).default(24),
  NOTIFICATION_OUTBOX_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(4),
  EMAIL_OUTBOX_MAX_ATTEMPTS: Joi.number().integer().min(1).max(30).default(8),
  RESEND_API_KEY: Joi.string().allow('').optional(),
  EMAIL_FROM: Joi.string().allow('').optional(),
  R2_ACCOUNT_ID: Joi.string().allow('').optional(),
  R2_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  R2_BUCKET: Joi.string().allow('').optional(),
  R2_PUBLIC_URL: Joi.string().uri().allow('').optional(),
  R2_MAX_UPLOAD_BYTES: Joi.number()
    .integer()
    .min(1024)
    .max(50 * 1024 * 1024)
    .default(5 * 1024 * 1024),
  R2_PRESIGN_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(300),
  MAX_IMPORT_ROWS: Joi.number().integer().min(1).max(50000).default(5000),
  IMPORT_BATCH_SIZE: Joi.number().integer().min(1).max(1000).default(100),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(10).default(120),
  AUTH_THROTTLE_LIMIT: Joi.number().integer().min(3).default(10),
  BACKUP_RETENTION_DAYS: Joi.number().integer().min(1).max(365).default(14),
  BUSINESS_TIMEZONE: Joi.string().default('Europe/Istanbul'),
});

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_EXPIRES_IN: string;
  REFRESH_TOKEN_EXPIRES_IN: string;
  REDIS_URL: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  CORS_ORIGINS?: string;
  SITE_NAME?: string;
  SITE_SUPPORT_EMAIL?: string;
  SITE_SUPPORT_PHONE?: string;
  SITE_ADDRESS?: string;
  SITE_PRIVACY_URL?: string;
  SITE_KVKK_URL?: string;
  SITE_TERMS_URL?: string;
  BANK_TRANSFER_BANK_NAME?: string;
  BANK_TRANSFER_IBAN?: string;
  BANK_TRANSFER_ACCOUNT_NAME?: string;
  PAYMENT_EXPIRY_HOURS?: number;
  NOTIFICATION_OUTBOX_MAX_ATTEMPTS?: number;
  EMAIL_OUTBOX_MAX_ATTEMPTS?: number;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_PUBLIC_URL?: string;
  R2_MAX_UPLOAD_BYTES?: number;
  R2_PRESIGN_TTL_SECONDS?: number;
  MAX_IMPORT_ROWS?: number;
  IMPORT_BATCH_SIZE?: number;
  THROTTLE_TTL_MS?: number;
  THROTTLE_LIMIT?: number;
  AUTH_THROTTLE_LIMIT?: number;
  BACKUP_RETENTION_DAYS?: number;
  BUSINESS_TIMEZONE?: string;
}
