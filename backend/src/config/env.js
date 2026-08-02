/**
 * Central env loader + typed accessor. Loads the project-root .env (and an
 * optional backend/.env) without overriding real environment variables
 * (so docker-compose / production values always win).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
// backend/src/config -> project root is three levels up
dotenv.config({ path: path.resolve(here, '../../../.env') });
dotenv.config({ path: path.resolve(here, '../../.env') });

const bool = (v, def = false) => {
  if (v === undefined || v === null || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const num = (v, def) => (v === undefined || v === '' ? def : Number(v));

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  tz: process.env.TZ || 'Asia/Riyadh',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  apiPort: num(process.env.API_PORT, 4000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  db: {
    url: process.env.DATABASE_URL || null,
    host: process.env.PGHOST || 'localhost',
    port: num(process.env.PGPORT, 5432),
    user: process.env.PGUSER || 'farfasha',
    password: process.env.PGPASSWORD || 'farfasha',
    database: process.env.PGDATABASE || 'farfasha',
  },

  redis: {
    url: process.env.REDIS_URL || null,
    host: process.env.REDIS_HOST || 'localhost',
    port: num(process.env.REDIS_PORT, 6379),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },

  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'farfasha',

  seed: {
    managerName: process.env.SEED_MANAGER_NAME || 'مدير المركز',
    managerEmail: process.env.SEED_MANAGER_EMAIL || 'manager@farfasha.sa',
    managerPassword: process.env.SEED_MANAGER_PASSWORD || 'manager123',
    staffName: process.env.SEED_STAFF_NAME || 'موظف الاستقبال',
    staffEmail: process.env.SEED_STAFF_EMAIL || 'staff@farfasha.sa',
    staffPassword: process.env.SEED_STAFF_PASSWORD || 'staff123',
  },

  whatsapp: {
    enabled: bool(process.env.WHATSAPP_ENABLED, false),
    provider: process.env.WHATSAPP_PROVIDER || 'log',
    defaultCountry: process.env.WHATSAPP_DEFAULT_COUNTRY || '966',
    meta: {
      token: process.env.WHATSAPP_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
      templates: {
        welcome: process.env.WHATSAPP_TEMPLATE_WELCOME || 'farfasha_welcome',
        warn_5: process.env.WHATSAPP_TEMPLATE_WARN5 || 'farfasha_warn5',
        time_up: process.env.WHATSAPP_TEMPLATE_TIMEUP || 'farfasha_timeup',
        review: process.env.WHATSAPP_TEMPLATE_REVIEW || 'farfasha_review',
        booking_confirmed: process.env.WHATSAPP_TEMPLATE_BOOKING || 'farfasha_booking_confirmed',
      },
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      from: process.env.TWILIO_WHATSAPP_FROM || '',
    },
    unifonic: {
      appSid: process.env.UNIFONIC_APP_SID || '',
      senderId: process.env.UNIFONIC_SENDER_ID || '',
    },
    whatsloop: {
      token: process.env.WHATSLOOP_TOKEN || '',
      // Tenant-specific subdomain — NOT the generic whatsloop.net host.
      baseUrl: process.env.WHATSLOOP_BASE_URL || 'https://blend-play-sip.whatsloop.net/api/v1',
      // Optional; only needed when the account has more than one WhatsApp channel.
      channelId: process.env.WHATSLOOP_CHANNEL_ID || '',
    },
  },

  payments: {
    enabled: bool(process.env.PAYMENTS_ENABLED, false),
    provider: process.env.PAYMENTS_PROVIDER || 'moyasar',
  },
};

export default env;
