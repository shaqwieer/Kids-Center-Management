/** Settings: single row per tenant. jsonb columns come back as parsed objects. */
import { db } from '../../config/db.js';

const DEFAULTS = {
  durations: [{ min: 30, price: 25 }, { min: 60, price: 40 }, { min: 120, price: 70 }],
  late_fee_per_minute: 0,
  center_name: 'Blend Play & Sip',
  tagline: '',
  primary_color: '#F97A53',
  currency: 'SAR',
  // Every fixed value a manager can change elsewhere is a PLACEHOLDER here —
  // the centre name and the extension length are settings, so spelling them out
  // in the text would make the message lie the moment either one changes.
  wa_templates: {
    welcome: {
      ar: 'مرحباً {الاسم}! 🎉 تم تسجيلك في {المركز}. احتفظي برمزك للزيارات القادمة: {الرمز}',
      en: 'Welcome {name}! 🎉 You are registered at {center}. Keep your code for next visits: {code}',
    },
    warn_5: {
      ar: 'تبقّى ٥ دقائق على انتهاء وقت لعب {الطفل} في {المركز} 🕐\nتبين تمديد {الدقائق} دقيقة إضافية؟ اضغطي هنا: {الرابط}',
      en: '5 minutes left before {child}\'s play time ends at {center} 🕐\nWant to add {minutes} more minutes? Tap here: {link}',
    },
    // Overtime is measured when the job fires — i.e. AT the end — so it is
    // always 0. Anything phrased as a running total would be a lie.
    time_up: {
      ar: 'انتهى وقت لعب {الطفل} 🕐\nنرجو التوجّه إلى الاستقبال — أي وقت إضافي يبدأ احتسابه من الآن.',
      en: '{child}\'s play time is up 🕐\nPlease come to reception — any extra time is counted from now.',
    },
    review: {
      ar: 'شكراً لزيارتكم {المركز} 💛 ما رأيك في الزيارة؟ وكيف نجعل تجربتك أجمل؟\n{الرابط}',
      en: 'Thank you for visiting {center} 💛 How was your visit, and how can we make your experience better?\n{link}',
    },
    booking_confirmed: {
      ar: 'تم تأكيد حجزك في {المركز} 🎉\nرقم الحجز: {المرجع}\nالتاريخ: {التاريخ} الساعة {الوقت}\nعدد الأطفال: {العدد}\nالمبلغ: {المبلغ}\nبانتظاركم! 💛',
      en: 'Your booking at {center} is confirmed 🎉\nReference: {ref}\nDate: {date} at {time}\nChildren: {count}\nAmount: {amount}\nSee you soon! 💛',
    },
  },
  // Language for outbound messages when the guardian has no preference of her own.
  default_lang: 'ar',
  payments_enabled: false,
  terms_url: null,
  terms_ar: null,
  terms_en: null,
  booking_config: {
    party: {
      enabled: true,
      base_price: 500,
      price_per_child: 35,
      min_children: 5,
      max_children: 40,
      duration_minutes: 180,
      slots: ['13:00', '17:00'],
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
  guardian_extend_minutes: 30,
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
    default_lang: DEFAULTS.default_lang,
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
  if (patch.terms_ar !== undefined) update.terms_ar = patch.terms_ar?.trim() || null;
  if (patch.terms_en !== undefined) update.terms_en = patch.terms_en?.trim() || null;
  if (patch.booking_config !== undefined) update.booking_config = JSON.stringify(patch.booking_config);
  if (patch.reviews_enabled !== undefined) update.reviews_enabled = patch.reviews_enabled;
  if (patch.review_delay_minutes !== undefined) update.review_delay_minutes = patch.review_delay_minutes;
  if (patch.guardian_extend_enabled !== undefined) update.guardian_extend_enabled = patch.guardian_extend_enabled;
  if (patch.guardian_extend_minutes !== undefined) update.guardian_extend_minutes = patch.guardian_extend_minutes;
  if (patch.default_lang !== undefined) update.default_lang = patch.default_lang;

  await ensureSettings(tenantId);
  await db('settings').where({ tenant_id: tenantId }).update(update);
  return db('settings').where({ tenant_id: tenantId }).first();
}

/** Has the centre written its own terms page (in either language)? */
export function hasTerms(row) {
  return Boolean(row?.terms_ar?.trim() || row?.terms_en?.trim());
}

export { DEFAULTS as DEFAULT_SETTINGS };
