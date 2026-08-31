import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  VALKEY_URL: z.string().url(),

  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1).default('cida-media'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_REGION: z.string().default('us-east-1'),

  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(720),
  COOKIE_DOMAIN: z.string().default('localhost'),
  // NOT z.coerce.boolean(): it treats every non-empty string as true, so
  // COOKIE_SECURE=false would set Secure on a plain-HTTP deploy and the admin
  // session cookie would never come back.
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  GOTENBERG_URL: z.string().url(),

  APP_URL: z.string().url(),
  SITE_URL: z.string().url(),

  RECONCILIATION_PROVIDER: z.string().default('fake'),

  // Payments — backend-selected rail (Bill Pay → PromptPay transfer → bank transfer).
  BILLER_COMP_CODE: z.string().default(''),
  // Merchant PromptPay proxy for the eWallet/transfer rail (tag-29). Empty
  // disables the rail. buildRailPayload() encodes it as a phone proxy, so a
  // value the tag-29 builder cannot encode must fail at boot — otherwise the
  // first real checkout 500s on PromptPayError instead of the container
  // refusing to start (AGENTS.md: crash the container on invalid config).
  PROMPTPAY_NUMBER: z
    .string()
    .default('')
    .refine((v) => v === '' || /^0\d{9}$/.test(v) || /^66\d{9}$/.test(v), {
      message:
        'must be a Thai mobile number (0XXXXXXXXX or 66XXXXXXXXX), or empty to disable the PromptPay transfer rail',
    }),
  // Bank transfer rail display details (no QR — shown when biller/ProxyPay are unset).
  BANK_NAME: z.string().default(''),
  BANK_ACCOUNT_NAME: z.string().default(''),
  BANK_ACCOUNT_NO: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function loadEnv(): Env {
  if (_env) return _env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  _env = parsed.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) throw new Error('Env not loaded — call loadEnv() first');
  return _env;
}
