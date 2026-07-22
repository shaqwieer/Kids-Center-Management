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
      ar: 'تبقّى ٥ دقائق على انتهاء وقت لعب {الطفل} في فرفشة 🕐\nتبين تمديد ساعة إضافية؟ اضغطي هنا: {الرابط}',
      en: '5 minutes left before {child}\'s play time ends at Farfasha 🕐\nWant to add another hour? Tap here: {link}',
    },
    time_up: {
      ar: 'انتهى وقت لعب {الطفل}. الوقت الإضافي حتى الآن: {الدقائق} دقيقة.',
      en: '{child}\'s play time is up. Overtime so far: {minutes} minutes.',
    },
    review: {
      ar: 'شكراً لزيارتكم {المركز} 💛 ما رأيك في الزيارة؟ وكيف نخدمك بشكل أفضل؟\n{الرابط}',
      en: 'Thank you for visiting {center} 💛 How was your visit, and how can we serve you better?\n{link}',
    },
  },
  payments_enabled: false,
  terms_url: null,
  booking_config: {
    party: {
      enabled: true,
      base_price: 500,
      price_per_child: 35,
      min_children: 5,
      max_children: 40,
      duration_minutes: 120,
      slots: ['12:00', '15:00', '18:00'],
      lead_hours: 24,
    },
    workshop: {
      enabled: true,
      base_price: 0,
      price_per_child: 60,
      min_children: 1,
      max_children: 20,
      duration_minutes: 90,
      slots: ['10:00', '16:00'],
      lead_hours: 24,
    },
    themes: [
      { key: 'princess', ar: 'أميرات', en: 'Princess' },
      { key: 'superhero', ar: 'أبطال خارقون', en: 'Superheroes' },
      { key: 'jungle', ar: 'أدغال', en: 'Jungle' },
      { key: 'space', ar: 'فضاء', en: 'Space' },
      { key: 'candy', ar: 'حلويات', en: 'Candy' },
    ],
    foods: [
      { key: 'none', ar: 'بدون ضيافة', en: 'No catering', price_per_child: 0 },
      { key: 'light', ar: 'ضيافة خفيفة', en: 'Light snacks', price_per_child: 15 },
      { key: 'full', ar: 'بوفيه كامل', en: 'Full buffet', price_per_child: 45 },
      { key: 'cake_only', ar: 'كيكة فقط', en: 'Cake only', price_per_child: 10 },
    ],
  },
  reviews_enabled: true,
  review_delay_minutes: 45,
  guardian_extend_enabled: true,
  guardian_extend_minutes: 60,
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
    booking_config: JSON.stringify(DEFAULTS.booking_config),
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
  if (patch.terms_url !== undefined) update.terms_url = patch.terms_url || null;
  if (patch.booking_config !== undefined) update.booking_config = JSON.stringify(patch.booking_config);
  if (patch.reviews_enabled !== undefined) update.reviews_enabled = patch.reviews_enabled;
  if (patch.review_delay_minutes !== undefined) update.review_delay_minutes = patch.review_delay_minutes;
  if (patch.guardian_extend_enabled !== undefined) update.guardian_extend_enabled = patch.guardian_extend_enabled;
  if (patch.guardian_extend_minutes !== undefined) update.guardian_extend_minutes = patch.guardian_extend_minutes;

  await ensureSettings(tenantId);
  await db('settings').where({ tenant_id: tenantId }).update(update);
  return db('settings').where({ tenant_id: tenantId }).first();
}

export { DEFAULTS as DEFAULT_SETTINGS };
