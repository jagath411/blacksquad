import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger';

// Load environment variables from .env file. Tests never read .env, so they cannot
// pick up real SMS keys or a real database by accident.
if (process.env.NODE_ENV !== 'test') dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val < 65536, {
      message: 'PORT must be a valid port number between 1 and 65535',
    }),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api'),
  CORS_ORIGIN: z.string().default('*'),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5000'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .default('mongodb://127.0.0.1:27017/blacksquad_db'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // Number of reverse proxies in front of the API, so rate limits see the real client IP.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // 32-byte key (hex or base64) for encrypting bank details at rest.
  // When unset, a key is derived from JWT_SECRET; set it explicitly in production.
  DATA_ENCRYPTION_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().min(10).optional(),
  GOOGLE_WEB_CLIENT_ID: z.string().optional(),
  GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
  GOOGLE_IOS_CLIENT_ID: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  FAST2SMS_API_KEY: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  CUSTOM_SMS_WEBHOOK_URL: z.string().optional(),
  SHOW_DEV_OTP: z.string().default('false'),
  // Push notifications through Expo's push service.
  PUSH_ENABLED: z.enum(['true', 'false']).default('true'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  // Error tracking; off when unset.
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Format errors without leaking sensitive data
  const issues = parsedEnv.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  logger.error({ detail: issues.join('\n') }, '❌ Invalid environment variables configuration:\n');
  process.exit(1);
}

export const env = parsedEnv.data;
export type EnvConfig = z.infer<typeof envSchema>;
