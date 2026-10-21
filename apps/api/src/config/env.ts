import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

function required(name: string, devDefault?: string): string {
  const v = process.env[name] ?? (isProd ? undefined : devDefault);
  if (!v) throw new Error(`Missing required env variable: ${name}`);
  return v;
}

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgres://postgres:postgres@localhost:5433/croissant'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: required('ADMIN_PASSWORD', 'admin12345'),
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
  paymentWebhookSecret: required('PAYMENT_WEBHOOK_SECRET', 'dev-webhook-secret'),
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:5173',
};
