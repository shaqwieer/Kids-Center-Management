/** Settings: single row per tenant. jsonb columns come back as parsed objects. */
import { db } from '../../config/db.js';

const DEFAULTS = {
  durations: [{ min: 30, price: 25 }, { min: 60, price: 40 }, { min: 120, price: 70 }],
  late_fee_per_minute: 0,
  center_name: 'فرفشة',
  tagline: 'حيث تبدأ المتعة',
  primary_color: '#F97A53',
  currency: 'SAR',
  wa_templates: {
    welcome: {
      ar: 'مرحباً {الاسم}! 🎉 تم تسجيلك في فرفشة. احتفظ برمزك للزيارات القادمة: {الرمز}',
      en: 'Welcome {name}! 🎉 You are registered at Farfasha. Keep your code for next visits: {code}',
    },
    warn_5: {
      ar: 'تبقّى ٥ دقائق على انتهاء وقت لعب {الطفل} في فرفشة 🕐',
      en: '5 minutes left before {child}\'s play time ends at Farfasha 🕐',
    },
    time_up: {
      ar: 'انتهى وقت لعب {الطفل}. الوقت الإضافي حتى الآن: {الدقائق} دقيقة.',
      en: '{child}\'s play time is up. Overtime so far: {minutes} minutes.',
    },
  },
  payments_enabled: false,
};

export async function ensureSettings(tenantId) {
  const existing = await db('settings').where({ tenant_id: tenantId }).first();
  if (existing) return existing;
  await db('settings').insert({
    tenant_id: tenantId,
    durations: JSON.stringify(DEFAULTS.durations),
    late_fee_per_minute: DEFAULTS.late_fee_per_minute,
    center_name: DEFAULTS.center_name,
    tagline: DEFAULTS.tagline,
    primary_color: DEFAULTS.primary_color,
    currency: DEFAULTS.currency,
    wa_templates: JSON.stringify(DEFAULTS.wa_templates),
    payments_enabled: DEFAULTS.payments_enabled,
  });
  return db('settings').where({ tenant_id: tenantId }).first();
}

export async function getSettings(tenantId) {
  return ensureSettings(tenantId);
}

export async function updateSettings(tenantId, patch) {
  const update = { updated_at: db.fn.now() };
  if (patch.durations !== undefined) update.durations = JSON.stringify(patch.durations);
  if (patch.late_fee_per_minute !== undefined) update.late_fee_per_minute = patch.late_fee_per_minute;
  if (patch.center_name !== undefined) update.center_name = patch.center_name;
  if (patch.tagline !== undefined) update.tagline = patch.tagline;
  if (patch.primary_color !== undefined) update.primary_color = patch.primary_color;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.wa_templates !== undefined) update.wa_templates = JSON.stringify(patch.wa_templates);
  if (patch.payments_enabled !== undefined) update.payments_enabled = patch.payments_enabled;

  await ensureSettings(tenantId);
  await db('settings').where({ tenant_id: tenantId }).update(update);
  return db('settings').where({ tenant_id: tenantId }).first();
}

export { DEFAULTS as DEFAULT_SETTINGS };
