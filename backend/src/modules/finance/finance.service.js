/**
 * Finance summary. Revenue/sessions are computed FOR REAL from completed
 * sessions (base price by duration + late fees), with all period boundaries in
 * Asia/Riyadh. Operating expenses come from the tenant-scoped expense ledger.
 */
import { db } from '../../config/db.js';
import { periodRange, trailingWeekDays } from '../../utils/time.js';
import { priceForDuration } from '../../lib/timing.js';
import { getSettings } from '../settings/settings.service.js';

const DAY_LABELS = {
  ar: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const EXPENSE_COLORS = {
  salaries: '#7C5CE0', rent: '#3E97D8', supplies: '#EC6A9C', utilities: '#F5A623',
  marketing: '#F97A53', maintenance: '#12A594', other: '#76808F',
};

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
  const expenseRows = await db('expenses').where({ tenant_id: tenantId })
    .andWhereBetween('incurred_at', [start, end]).orderBy('incurred_at', 'desc');

  let baseRevenue = 0;
  let lateRevenue = 0;
  for (const r of rows) {
    const { base, late } = sessionRevenue(r, durations);
    baseRevenue += base;
    lateRevenue += late;
  }

  // The other two income sources: parties and workshops. A booking is counted
  // once it is confirmed (the slot is committed and the price is frozen).
  const bookingRows = await db('bookings')
    .where({ tenant_id: tenantId })
    .whereIn('status', ['confirmed', 'completed'])
    .andWhereBetween('starts_at', [start, end])
    .select('id', 'type', 'amount', 'starts_at', 'guardian_name', 'reference');
  const partyRevenue = bookingRows.filter((b) => b.type === 'party')
    .reduce((s, b) => s + Number(b.amount), 0);
  const workshopRevenue = bookingRows.filter((b) => b.type === 'workshop')
    .reduce((s, b) => s + Number(b.amount), 0);

  const revenue = baseRevenue + lateRevenue + partyRevenue + workshopRevenue;

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
  const incomeTxns = recent.map((r) => ({
    io: 'in',
    source: 'play',
    label: r.child_name,
    amount: sessionRevenue(r, durations).total,
    at: r.ended_at,
    placeholder: false,
  }));
  const bookingTxns = bookingRows.slice(0, 8).map((b) => ({
    io: 'in',
    source: b.type === 'party' ? 'parties' : 'workshops',
    label: `${b.guardian_name} · ${b.reference}`,
    amount: Number(b.amount),
    at: b.starts_at,
    placeholder: false,
  }));

  const expensesTotal = expenseRows.reduce((sum, e) => sum + Number(e.amount), 0);
  const byCategory = expenseRows.reduce((out, e) => {
    out[e.category] = (out[e.category] || 0) + Number(e.amount);
    return out;
  }, {});
  const expenses = Object.entries(byCategory).map(([category, amount]) => ({
    key: `e_${category}`, category, amount, color: EXPENSE_COLORS[category] || EXPENSE_COLORS.other,
  })).sort((a, b) => b.amount - a.amount);
  const expenseTxns = expenseRows.slice(0, 10).map((e) => ({
    id: e.id, io: 'out', label: e.title, category: e.category, amount: Number(e.amount),
    at: e.incurred_at, notes: e.notes, placeholder: false,
  }));
  const txns = [...incomeTxns, ...bookingTxns, ...expenseTxns]
    .sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
  const revenueBreakdown = [
    { key: 'r_sessions', amount: baseRevenue, color: '#F97A53' },
    { key: 'r_late', amount: lateRevenue, color: '#F5A623' },
    { key: 'r_parties', amount: partyRevenue, color: '#7C5CE0' },
    { key: 'r_workshops', amount: workshopRevenue, color: '#12A594' },
  ];

  return {
    period,
    currency,
    kpis: {
      revenue,
      expenses: expensesTotal,
      net: revenue - expensesTotal,
      sessions: rows.length,
      bookings: bookingRows.length,
    },
    weekly,
    revenueBreakdown,
    expenses,
    expenseEntries: expenseRows.map((e) => ({ ...e, amount: Number(e.amount) })),
    txns,
    placeholder: { expenses: false, expense_transactions: false },
  };
}
