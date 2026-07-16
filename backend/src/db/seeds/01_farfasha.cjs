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

const WA_TEMPLATES = {
  welcome: {
    ar: 'مرحباً {الاسم}! 🎉 تم تسجيلك في فرفشة. احتفظ برمزك للزيارات القادمة: {الرمز}',
    en: 'Welcome {name}! 🎉 You are registered at Farfasha. Keep your code for next visits: {code}',
  },
  warn_5: {
    ar: 'تبقّى ٥ دقائق على انتهاء وقت لعب {الطفل} في فرفشة 🕐',
    en: "5 minutes left before {child}'s play time ends at Farfasha 🕐",
  },
  time_up: {
    ar: 'انتهى وقت لعب {الطفل}. الوقت الإضافي حتى الآن: {الدقائق} دقيقة.',
    en: "{child}'s play time is up. Overtime so far: {minutes} minutes.",
  },
};

const CUSTOMERS = [
  {
    full_name: 'نورة العتيبي', phone: '0551234567', national_id: '1098000000', code: 'FRF-2048',
    children: [
      { name: 'عبدالله', gender: 'm', age: 6 },
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
    center_name: 'فرفشة',
    tagline: 'حيث تبدأ المتعة',
    primary_color: '#F97A53',
    currency: 'SAR',
    wa_templates: JSON.stringify(WA_TEMPLATES),
    payments_enabled: false,
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
      def.children.map((k) => ({ customer_id: c.id, name: k.name, gender: k.gender, age: k.age })),
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
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant '${slug}': ${CUSTOMERS.length} customers, ${LIVE.length} live sessions.`);
};
