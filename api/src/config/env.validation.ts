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
  CORS_ORIGINS: Joi.string().allow('').optional(),
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
}
