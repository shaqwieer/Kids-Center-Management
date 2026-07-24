/**
 * Business analytics — "أهم المعلومات" (busiest days) plus the developmental
 * trend reporting. Everything here is derived from real rows; nothing is faked.
 *
 * All day/hour bucketing is done IN Asia/Riyadh via `at time zone`, otherwise a
 * 9pm Riyadh visit would land on the previous day's UTC bucket and the "busiest
 * day" answer would be quietly wrong.
 */
import { DateTime } from 'luxon';
import { db } from '../../config/db.js';
import { ZONE, periodRange } from '../../utils/time.js';
import { priceForDuration } from '../../lib/timing.js';
import { getSettings } from '../settings/settings.service.js';

const DAY_LABELS = {
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const label = (lang, i) => (DAY_LABELS[lang] || DAY_LABELS.en)[i] ?? '';

/**
 * Sessions grouped by Riyadh weekday (0=Sun) and hour-of-day, within the
 * selected reporting window. One query, bucketed in SQL so we never pull
 * thousands of rows. Scoping this to the chosen period (today/week/month) is
 * what makes the period tabs visibly drive the whole page, not just the KPIs.
 */
async function busyBuckets(tenantId, start, end) {
  const rows = await db('sessions')
    .where({ tenant_id: tenantId })
    .andWhereBetween('started_at', [start, end])
    .select(
      db.raw(`extract(dow from (started_at at time zone ?))::int as weekday`, [ZONE]),
      db.raw(`extract(hour from (started_at at time zone ?))::int as hour`, [ZONE]),
    )
    .count('* as count')
    .groupBy('weekday', 'hour');
  return rows.map((r) => ({ weekday: Number(r.weekday), hour: Number(r.hour), count: Number(r.count) }));
}

/** Revenue + visit counts per calendar month for the last N months (trend line). */
async function monthlyTrend(tenantId, months, durations) {
  const since = DateTime.now().setZone(ZONE).minus({ months: months - 1 }).startOf('month');
  const rows = await db('sessions')
    .where({ tenant_id: tenantId })
    .andWhere('status', 'completed')
    .andWhere('ended_at', '>=', since.toUTC().toJSDate())
    .select('duration_minutes', 'late_fee', 'ended_at', 'customer_id');

  const bookingRows = await db('bookings')
    .where({ tenant_id: tenantId })
    .whereIn('status', ['confirmed', 'completed'])
    .andWhere('starts_at', '>=', since.toUTC().toJSDate())
    .select('amount', 'starts_at', 'type');

  const buckets = new Map();
  for (let i = 0; i < months; i += 1) {
    const m = since.plus({ months: i });
    buckets.set(m.toFormat('yyyy-MM'), {
      month: m.toFormat('yyyy-MM'),
      sessions: 0,
      session_revenue: 0,
      booking_revenue: 0,
      revenue: 0,
    });
  }

  for (const r of rows) {
    const key = DateTime.fromJSDate(new Date(r.ended_at)).setZone(ZONE).toFormat('yyyy-MM');
    const b = buckets.get(key);
    if (!b) continue; // eslint-disable-line no-continue
    b.sessions += 1;
    b.session_revenue += priceForDuration(durations, r.duration_minutes) + (Number(r.late_fee) || 0);
  }
  for (const r of bookingRows) {
    const key = DateTime.fromJSDate(new Date(r.starts_at)).setZone(ZONE).toFormat('yyyy-MM');
    const b = buckets.get(key);
    if (!b) continue; // eslint-disable-line no-continue
    b.booking_revenue += Number(r.amount) || 0;
  }

  const out = [...buckets.values()];
  for (const b of out) b.revenue = Math.round((b.session_revenue + b.booking_revenue) * 100) / 100;

  // Month-over-month growth on the last two closed buckets.
  const prev = out[out.length - 2];
  const curr = out[out.length - 1];
  const growth = prev && prev.revenue > 0
    ? Math.round(((curr.revenue - prev.revenue) / prev.revenue) * 1000) / 10
    : null;

  return { series: out, growth_pct: growth };
}

/**
 * The dashboard headline block. Every figure — busy patterns, KPIs, income —
 * is scoped to the selected `period` (today/week/month) so switching the tab
 * changes the whole page; only the 6-month trend line is intentionally rolling.
 */
export async function insights(tenantId, { period = 'month', lang = 'ar' } = {}) {
  const settings = await getSettings(tenantId);
  const durations = settings.durations;
  const { start, end } = periodRange(period);

  const buckets = await busyBuckets(tenantId, start, end);

  // Busiest day of week.
  const perDay = Array.from({ length: 7 }, (_, i) => ({
    weekday: i, label: label(lang, i), count: 0,
  }));
  for (const b of buckets) perDay[b.weekday].count += b.count;
  const busiestDay = perDay.reduce((a, b) => (b.count > a.count ? b : a), perDay[0]);

  // Busiest hour of day.
  const perHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const b of buckets) perHour[b.hour].count += b.count;
  const busiestHour = perHour.reduce((a, b) => (b.count > a.count ? b : a), perHour[0]);

  // Period figures.
  const periodSessions = await db('sessions')
    .where({ tenant_id: tenantId })
    .andWhere('status', 'completed')
    .andWhereBetween('ended_at', [start, end])
    .select('duration_minutes', 'late_fee', 'started_at', 'ended_at', 'customer_id', 'child_id');

  const avgDuration = periodSessions.length
    ? Math.round(periodSessions.reduce((s, r) => s + r.duration_minutes, 0) / periodSessions.length)
    : 0;

  const avgPlayed = periodSessions.length
    ? Math.round(periodSessions.reduce((s, r) => {
      const played = (new Date(r.ended_at) - new Date(r.started_at)) / 60000;
      return s + Math.max(0, played);
    }, 0) / periodSessions.length)
    : 0;

  // New vs returning: a customer counts as "new" if their first-ever session
  // falls inside the period.
  const firstVisits = await db('sessions')
    .where({ tenant_id: tenantId })
    .select('customer_id')
    .min('started_at as first_at')
    .groupBy('customer_id');
  const newCustomers = firstVisits.filter((r) => {
    const t = new Date(r.first_at).getTime();
    return t >= start.getTime() && t <= end.getTime();
  }).length;
  const activeCustomers = new Set(periodSessions.map((r) => r.customer_id)).size;

  // Repeat rate across the whole history — how many families came back at all.
  const visitCounts = await db('sessions')
    .where({ tenant_id: tenantId })
    .select('customer_id')
    .count('* as visits')
    .groupBy('customer_id');
  const repeaters = visitCounts.filter((r) => Number(r.visits) > 1).length;
  const repeatRate = visitCounts.length
    ? Math.round((repeaters / visitCounts.length) * 100)
    : 0;

  // Which duration the centre actually sells.
  const durationMix = (durations || []).map((d) => ({
    minutes: Number(d.min),
    price: Number(d.price),
    count: periodSessions.filter((r) => r.duration_minutes === Number(d.min)).length,
  })).sort((a, b) => b.count - a.count);

  // Income by source — play time vs parties vs workshops.
  const sessionRevenue = periodSessions.reduce(
    (s, r) => s + priceForDuration(durations, r.duration_minutes) + (Number(r.late_fee) || 0), 0,
  );
  const bookingRows = await db('bookings')
    .where({ tenant_id: tenantId })
    .whereIn('status', ['confirmed', 'completed'])
    .andWhereBetween('starts_at', [start, end])
    .select('type', 'amount');
  const partyRevenue = bookingRows.filter((b) => b.type === 'party')
    .reduce((s, b) => s + Number(b.amount), 0);
  const workshopRevenue = bookingRows.filter((b) => b.type === 'workshop')
    .reduce((s, b) => s + Number(b.amount), 0);

  const trend = await monthlyTrend(tenantId, 6, durations);

  // Child demographics — supports the "developmental" reporting ask.
  const kids = await db('children as ch')
    .join('customers as c', 'c.id', 'ch.customer_id')
    .where('c.tenant_id', tenantId)
    .select('ch.gender', 'ch.age', 'ch.birthdate', 'ch.has_allergy');
  const ageOf = (k) => {
    if (k.birthdate) {
      const yrs = DateTime.now().diff(DateTime.fromJSDate(new Date(k.birthdate)), 'years').years;
      if (Number.isFinite(yrs) && yrs >= 0) return Math.floor(yrs);
    }
    return k.age != null ? Number(k.age) : null;
  };
  const AGE_BANDS = [[0, 2], [3, 5], [6, 8], [9, 12], [13, 99]];
  const ageBands = AGE_BANDS.map(([lo, hi]) => ({
    from: lo,
    to: hi,
    count: kids.filter((k) => {
      const a = ageOf(k);
      return a != null && a >= lo && a <= hi;
    }).length,
  }));

  return {
    period,
    currency: settings.currency,
    busiest_day: busiestDay,
    busiest_hour: busiestHour,
    by_weekday: perDay,
    by_hour: perHour,
    heatmap: buckets,
    kpis: {
      sessions: periodSessions.length,
      avg_duration_minutes: avgDuration,
      avg_played_minutes: avgPlayed,
      new_customers: newCustomers,
      active_customers: activeCustomers,
      repeat_rate_pct: repeatRate,
      children_total: kids.length,
      children_with_allergy: kids.filter((k) => k.has_allergy).length,
    },
    income_sources: [
      { key: 'play', amount: Math.round(sessionRevenue * 100) / 100, color: '#F97A53' },
      { key: 'parties', amount: Math.round(partyRevenue * 100) / 100, color: '#7C5CE0' },
      { key: 'workshops', amount: Math.round(workshopRevenue * 100) / 100, color: '#12A594' },
    ],
    duration_mix: durationMix,
    gender_mix: {
      m: kids.filter((k) => k.gender === 'm').length,
      f: kids.filter((k) => k.gender === 'f').length,
      unknown: kids.filter((k) => !k.gender).length,
    },
    age_bands: ageBands,
    trend,
  };
}
