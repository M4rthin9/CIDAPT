import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error'])
    .default('info'),
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
  COOKIE_SECURE: z.coerce.boolean().default(false),

  GOTENBERG_URL: z.string().url(),

  APP_URL: z.string().url(),
  SITE_URL: z.string().url(),

  RECONCILIATION_PROVIDER: z.string().default('fake'),
  BILLER_COMP_CODE: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function loadEnv(): Env {
  if (_env) return _env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  _env = parsed.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) throw new Error('Env not loaded — call loadEnv() first');
  return _env;
}
