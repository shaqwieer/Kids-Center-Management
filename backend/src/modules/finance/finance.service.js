/**
 * Finance summary. Revenue/sessions are computed FOR REAL from completed
 * sessions (base price by duration + late fees), with all period boundaries in
 * Asia/Riyadh. Expenses/packages are NOT in the data model yet, so they are
 * returned as clearly-flagged future-ready placeholders (see `placeholder`).
 */
import { db } from '../../config/db.js';
import { periodRange, trailingWeekDays } from '../../utils/time.js';
import { priceForDuration } from '../../lib/timing.js';
import { getSettings } from '../settings/settings.service.js';

const DAY_LABELS = {
  ar: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

// Placeholder expense categories (future-ready; no expenses table yet).
const PLACEHOLDER_EXPENSES = [
  { key: 'e_salaries', v: 12000, c: '#7C5CE0' },
  { key: 'e_rent', v: 8000, c: '#3E97D8' },
  { key: 'e_supplies', v: 3200, c: '#EC6A9C' },
  { key: 'e_utilities', v: 1800, c: '#F5A623' },
  { key: 'e_marketing', v: 1500, c: '#F97A53' },
  { key: 'e_maint', v: 900, c: '#12A594' },
];

function sessionRevenue(row, durations) {
  const base = priceForDuration(durations, row.duration_minutes);
  const late = Number(row.late_fee) || 0;
  return { base, late, total: base + late };
}

async function completedBetween(tenantId, start, end) {
  return db('sessions')
    .where({ tenant_id: tenantId })
    .andWhere('status', 'completed')
    .andWhereBetween('ended_at', [start, end])
    .select('id', 'duration_minutes', 'late_fee', 'ended_at', 'child_id', 'customer_id');
}

export async function summary(tenantId, period = 'month', lang = 'ar') {
  const settings = await getSettings(tenantId);
  const durations = settings.durations;
  const currency = settings.currency;

  const { start, end } = periodRange(period);
  const rows = await completedBetween(tenantId, start, end);

  let baseRevenue = 0;
  let lateRevenue = 0;
  for (const r of rows) {
    const { base, late } = sessionRevenue(r, durations);
    baseRevenue += base;
    lateRevenue += late;
  }
  const revenue = baseRevenue + lateRevenue;

  // Weekly bars — trailing 7 days ending today (Riyadh).
  const days = trailingWeekDays();
  const weekRows = await completedBetween(tenantId, days[0].start, days[6].end);
  const weekly = days.map((d, i) => {
    const amount = weekRows
      .filter((r) => {
        const t = new Date(r.ended_at).getTime();
        return t >= d.start.getTime() && t <= d.end.getTime();
      })
      .reduce((sum, r) => sum + sessionRevenue(r, durations).total, 0);
    return {
      label: DAY_LABELS[lang]?.[d.weekday] ?? DAY_LABELS.en[d.weekday],
      weekday: d.weekday,
      amount,
      is_today: i === 6,
    };
  });

  // Recent completed sessions as income transactions (real).
  const recent = await db('sessions as s')
    .join('children as ch', 'ch.id', 's.child_id')
    .where('s.tenant_id', tenantId)
    .andWhere('s.status', 'completed')
    .orderBy('s.ended_at', 'desc')
    .limit(8)
    .select('s.id', 's.duration_minutes', 's.late_fee', 's.ended_at', 'ch.name as child_name');
  const txns = recent.map((r) => ({
    io: 'in',
    label: r.child_name,
    amount: sessionRevenue(r, durations).total,
    at: r.ended_at,
    placeholder: false,
  }));

  const expensesTotal = PLACEHOLDER_EXPENSES.reduce((a, b) => a + b.v, 0);
  const revenueBreakdown = [
    { key: 'r_sessions', amount: baseRevenue, color: '#F97A53' },
    { key: 'r_late', amount: lateRevenue, color: '#F5A623' },
    { key: 'r_pkg', amount: 0, color: '#12A594' },
  ];

  return {
    period,
    currency,
    kpis: {
      revenue,
      expenses: 0, // real expenses not tracked yet
      net: revenue,
      sessions: rows.length,
    },
    weekly,
    revenueBreakdown,
    // Placeholder — the Finance screen shows these under a "future-ready" badge.
    expenses: PLACEHOLDER_EXPENSES.map((e) => ({ key: e.key, amount: e.v, color: e.c })),
    expensesPlaceholderTotal: expensesTotal,
    txns,
    placeholder: {
      expenses: true,
      expense_transactions: true,
      note: 'Expenses/packages are demo placeholders until an expenses module is added. Revenue, sessions and weekly bars are computed from real completed sessions.',
    },
  };
}
