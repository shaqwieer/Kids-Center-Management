/**
 * Seed: one tenant (فرفشة), admin + staff users, settings, and the Arabic sample
 * customers/children from the design — plus visit history and a few LIVE sessions
 * so the dashboard is populated immediately after seeding.
 *
 * NOTE: seeded live sessions are display-only — they have no scheduled BullMQ
 * jobs (seeds run outside the app process). Sessions started through the UI DO
 * schedule warn_5/time_up notifications normally. Add-time/End on seeded sessions
 * works correctly (it schedules against a fresh version).
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const token = () => crypto.randomBytes(16).toString('hex');
const MIN = 60_000;

// Kept in step with DEFAULTS in settings.service.js. Anything a manager can
// change elsewhere ({المركز}, {الدقائق}) stays a placeholder — spelling it out
// makes the message lie as soon as the setting changes.
const WA_TEMPLATES = {
  welcome: {
    ar: 'مرحباً {الاسم}! 🎉 تم تسجيلك في {المركز}. احتفظي برمزك للزيارات القادمة: {الرمز}',
    en: 'Welcome {name}! 🎉 You are registered at {center}. Keep your code for next visits: {code}',
  },
  // {الرابط} is the mother's one-tap "add time" page. Dropping it here would
  // silently disable guardian self-extension on every freshly seeded install —
  // the worker only sends a link the template asks for. Invitation and link stay
  // on ONE line so stripPlaceholderLines() can remove the whole offer together.
  warn_5: {
    ar: 'تبقّى ٥ دقائق على انتهاء وقت لعب {الطفل} في {المركز} 🕐\nتبين تمديد {الدقائق} دقيقة إضافية؟ اضغطي هنا: {الرابط}',
    en: "5 minutes left before {child}'s play time ends at {center} 🕐\nWant to add {minutes} more minutes? Tap here: {link}",
  },
  // No running total: overtime is measured when the job fires, i.e. at the end.
  time_up: {
    ar: 'انتهى وقت لعب {الطفل} 🕐\nنرجو التوجّه إلى الاستقبال — أي وقت إضافي يبدأ احتسابه من الآن.',
    en: "{child}'s play time is up 🕐\nPlease come to reception — any extra time is counted from now.",
  },
  review: {
    ar: 'شكراً لزيارتكم {المركز} 💛 ما رأيك في الزيارة؟ وكيف نخدمك بشكل أفضل؟\n{الرابط}',
    en: 'Thank you for visiting {center} 💛 How was your visit, and how can we serve you better?\n{link}',
  },
  booking_confirmed: {
    ar: 'تم تأكيد حجزك في {المركز} 🎉\nرقم الحجز: {المرجع}\nالتاريخ: {التاريخ} الساعة {الوقت}\nعدد الأطفال: {العدد}\nالمبلغ: {المبلغ}\nبانتظاركم! 💛',
    en: 'Your booking at {center} is confirmed 🎉\nReference: {ref}\nDate: {date} at {time}\nChildren: {count}\nAmount: {amount}\nSee you soon! 💛',
  },
};

// Party & workshop pricing/slots the booking page reads. Kept in step with
// DEFAULTS in settings.service.js.
const BOOKING_CONFIG = {
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
};

const CUSTOMERS = [
  {
    full_name: 'نورة العتيبي', phone: '0551234567', national_id: '1098000000', code: 'FRF-2048',
    children: [
      { name: 'عبدالله', gender: 'm', age: 6, allergy: 'حساسية من المكسرات' },
      { name: 'جوري', gender: 'f', age: 4 },
    ],
    visits: [
      { child: 'عبدالله', dur: 60, played: 58, daysAgo: 8 },
      { child: 'جوري', dur: 30, played: 30, daysAgo: 15 },
      { child: 'عبدالله', dur: 120, played: 126, daysAgo: 28 },
    ],
  },
  {
    full_name: 'سارة القحطاني', phone: '0559876543', national_id: null, code: 'FRF-3172',
    children: [
      { name: 'لين', gender: 'f', age: 5 },
      { name: 'تركي', gender: 'm', age: 7 },
    ],
    visits: [{ child: 'لين', dur: 60, played: 64, daysAgo: 11 }],
  },
  {
    full_name: 'هند الشمري', phone: '0533221144', national_id: null, code: 'FRF-5590',
    children: [{ name: 'ريان', gender: 'm', age: 5 }],
    visits: [],
  },
  {
    full_name: 'ريم الدوسري', phone: '0544778899', national_id: null, code: 'FRF-6621',
    children: [
      { name: 'رغد', gender: 'f', age: 6 },
      { name: 'فيصل', gender: 'm', age: 3 },
    ],
    visits: [],
  },
  {
    full_name: 'لطيفة الغامدي', phone: '0566554433', national_id: null, code: 'FRF-7745',
    children: [
      { name: 'يوسف', gender: 'm', age: 8 },
      { name: 'دانة', gender: 'f', age: 5 },
    ],
    visits: [],
  },
];

// Live sessions: [customer index, child name, duration, minutes since start]
const LIVE = [
  [0, 'عبدالله', 60, 56], // ~4 min left -> warned
  [1, 'لين', 60, 69], // overtime
  [2, 'ريان', 30, 12], // playing
  [3, 'رغد', 120, 8], // playing
  [4, 'يوسف', 60, 38], // playing
];

function liveStatus(startMs, dur) {
  const endMs = startMs + dur * MIN;
  const rem = endMs - Date.now();
  if (rem <= 0) return 'overtime';
  if (rem <= 5 * MIN) return 'warned';
  return 'active';
}

exports.seed = async function seed(knex) {
  await knex('notifications').del();
  // Explicit, in FK order — reviews reference sessions AND bookings, so relying
  // on the tenant cascade alone makes the delete order fragile.
  await knex('reviews').del();
  await knex('bookings').del();
  await knex('sessions').del();
  await knex('children').del();
  await knex('customers').del();
  await knex('settings').del();
  await knex('users').del();
  await knex('tenants').del();

  const slug = process.env.DEFAULT_TENANT_SLUG || 'farfasha';
  const [tenant] = await knex('tenants').insert({ slug, name: 'فرفشة' }).returning('*');

  const [admin] = await knex('users').insert({
    tenant_id: tenant.id,
    name: process.env.SEED_MANAGER_NAME || 'مدير المركز',
    email: process.env.SEED_MANAGER_EMAIL || 'manager@farfasha.sa',
    password_hash: bcrypt.hashSync(process.env.SEED_MANAGER_PASSWORD || 'manager123', 10),
    role: 'manager',
  }).returning('*');

  await knex('users').insert({
    tenant_id: tenant.id,
    name: process.env.SEED_STAFF_NAME || 'موظف الاستقبال',
    email: process.env.SEED_STAFF_EMAIL || 'staff@farfasha.sa',
    password_hash: bcrypt.hashSync(process.env.SEED_STAFF_PASSWORD || 'staff123', 10),
    role: 'staff',
  });

  await knex('settings').insert({
    tenant_id: tenant.id,
    durations: JSON.stringify([{ min: 30, price: 25 }, { min: 60, price: 40 }, { min: 120, price: 70 }]),
    late_fee_per_minute: 1.5,
    center_name: 'Blend Play & Sip',
    tagline: '',
    primary_color: '#F97A53',
    currency: 'SAR',
    wa_templates: JSON.stringify(WA_TEMPLATES),
    payments_enabled: false,
    booking_config: JSON.stringify(BOOKING_CONFIG),
    reviews_enabled: true,
    review_delay_minutes: 45,
    guardian_extend_enabled: true,
    guardian_extend_minutes: 60,
  });

  const lateRate = 1.5;

  const created = [];
  for (const def of CUSTOMERS) {
    // eslint-disable-next-line no-await-in-loop
    const [c] = await knex('customers').insert({
      tenant_id: tenant.id,
      full_name: def.full_name,
      phone: def.phone,
      national_id: def.national_id,
      customer_code: def.code,
      qr_token: token(),
      consent: true,
    }).returning('*');
    // eslint-disable-next-line no-await-in-loop
    const kids = await knex('children').insert(
      def.children.map((k) => ({
        customer_id: c.id,
        name: k.name,
        gender: k.gender,
        age: k.age,
        // Birthdate is what the form now asks for; age is kept in step.
        birthdate: k.age != null ? `${new Date().getFullYear() - k.age}-06-15` : null,
        has_allergy: Boolean(k.allergy),
        allergy_note: k.allergy || null,
      })),
    ).returning('*');
    created.push({ def, c, kids });

    // Visit history (completed sessions)
    for (const v of def.visits) {
      const kid = kids.find((k) => k.name === v.child);
      if (!kid) continue; // eslint-disable-line no-continue
      const startAt = new Date(Date.now() - v.daysAgo * 24 * 60 * MIN + 13 * 60 * MIN); // ~1pm-ish
      const endsAt = new Date(startAt.getTime() + v.dur * MIN);
      const endedAt = new Date(startAt.getTime() + v.played * MIN);
      const lateMin = Math.max(0, Math.ceil((endedAt.getTime() - endsAt.getTime()) / MIN));
      // eslint-disable-next-line no-await-in-loop
      await knex('sessions').insert({
        tenant_id: tenant.id,
        customer_id: c.id,
        child_id: kid.id,
        duration_minutes: v.dur,
        started_at: startAt,
        ends_at: endsAt,
        ended_at: endedAt,
        status: 'completed',
        started_by: admin.id,
        late_minutes: lateMin,
        late_fee: Math.round(lateMin * lateRate * 100) / 100,
        schedule_version: 2,
      });
    }
  }

  // Live sessions
  for (const [ci, childName, dur, minsAgo] of LIVE) {
    const entry = created[ci];
    const kid = entry.kids.find((k) => k.name === childName) || entry.kids[0];
    const startMs = Date.now() - minsAgo * MIN;
    await knex('sessions').insert({
      tenant_id: tenant.id,
      customer_id: entry.c.id,
      child_id: kid.id,
      duration_minutes: dur,
      started_at: new Date(startMs),
      ends_at: new Date(startMs + dur * MIN),
      status: liveStatus(startMs, dur),
      started_by: admin.id,
      schedule_version: 0,
      // Live sessions need a token or their 5-minute warning has no link to offer.
      guest_token: token(),
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant '${slug}': ${CUSTOMERS.length} customers, ${LIVE.length} live sessions.`);
};
