/**
 * Finance summary. Revenue/sessions are computed FOR REAL from completed
 * sessions (base price by duration + late fees), with all period boundaries in
 * Asia/Riyadh. Operating expenses come from the tenant-scoped expense ledger.
 */
import { DateTime } from 'luxon';
import { db } from '../../config/db.js';
import { periodRange, trailingWeekDays, ZONE } from '../../utils/time.js';
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
  // A voucher-paid visit was already counted when the voucher was sold.
  const base = Math.max(0, priceForDuration(durations, row.duration_minutes) - (Number(row.discount) || 0));
  const late = Number(row.late_fee) || 0;
  return { base, late, total: base + late };
}

async function completedBetween(tenantId, start, end) {
  return db('sessions')
    .where({ tenant_id: tenantId })
    .andWhere('status', 'completed')
    .andWhereBetween('ended_at', [start, end])
    .select('id', 'duration_minutes', 'late_fee', 'discount', 'ended_at', 'child_id', 'customer_id');
}

/** Gift vouchers sold in a window — income on the sale day. Cancelled ones were refunded. */
async function voucherSalesBetween(tenantId, start, end) {
  return db('vouchers')
    .where({ tenant_id: tenantId })
    .whereNot('status', 'void')
    .andWhere('sold_price', '>', 0)
    .andWhereBetween('created_at', [start, end])
    .select('id', 'code', 'sold_price', 'buyer_name', 'recipient_name', 'created_at');
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

  const voucherRows = await voucherSalesBetween(tenantId, start, end);
  const voucherRevenue = voucherRows.reduce((s, v) => s + Number(v.sold_price), 0);

  const revenue = baseRevenue + lateRevenue + partyRevenue + workshopRevenue + voucherRevenue;

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
    .select('s.id', 's.duration_minutes', 's.late_fee', 's.discount', 's.ended_at', 'ch.name as child_name');
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

  const voucherTxns = voucherRows.slice(0, 8).map((v) => ({
    io: 'in',
    source: 'vouchers',
    label: [v.buyer_name || v.recipient_name, v.code].filter(Boolean).join(' · '),
    amount: Number(v.sold_price),
    at: v.created_at,
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
  const txns = [...incomeTxns, ...bookingTxns, ...voucherTxns, ...expenseTxns]
    .sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
  const revenueBreakdown = [
    { key: 'r_sessions', amount: baseRevenue, color: '#F97A53' },
    { key: 'r_late', amount: lateRevenue, color: '#F5A623' },
    { key: 'r_parties', amount: partyRevenue, color: '#7C5CE0' },
    { key: 'r_workshops', amount: workshopRevenue, color: '#12A594' },
    { key: 'r_vouchers', amount: voucherRevenue, color: '#EC6A9C' },
  ];

  // ---- Revenue-focused headline answers -----------------------------------
  // Best single revenue day WITHIN the selected period (play + bookings).
  const dayMap = new Map();
  const addDay = (at, amt) => {
    const key = DateTime.fromJSDate(new Date(at)).setZone(ZONE).toFormat('yyyy-MM-dd');
    dayMap.set(key, (dayMap.get(key) || 0) + amt);
  };
  for (const r of rows) addDay(r.ended_at, sessionRevenue(r, durations).total);
  for (const b of bookingRows) addDay(b.starts_at, Number(b.amount));
  for (const v of voucherRows) addDay(v.created_at, Number(v.sold_price));
  let topRevenueDay = null;
  for (const [date, amount] of dayMap) {
    if (!topRevenueDay || amount > topRevenueDay.amount) topRevenueDay = { date, amount };
  }

  // Best revenue month across the trailing 12 months (rolling, period-agnostic —
  // a "best month" only makes sense over a span longer than the current period).
  const monthFloor = DateTime.now().setZone(ZONE).minus({ months: 11 }).startOf('month').toUTC().toJSDate();
  const [monthSessions, monthBookings, monthVouchers] = await Promise.all([
    db('sessions').where({ tenant_id: tenantId }).andWhere('status', 'completed')
      .andWhere('ended_at', '>=', monthFloor).select('duration_minutes', 'late_fee', 'discount', 'ended_at'),
    db('bookings').where({ tenant_id: tenantId }).whereIn('status', ['confirmed', 'completed'])
      .andWhere('starts_at', '>=', monthFloor).select('amount', 'starts_at'),
    voucherSalesBetween(tenantId, monthFloor, new Date()),
  ]);
  const monthMap = new Map();
  const addMonth = (at, amt) => {
    const key = DateTime.fromJSDate(new Date(at)).setZone(ZONE).toFormat('yyyy-MM');
    monthMap.set(key, (monthMap.get(key) || 0) + amt);
  };
  for (const r of monthSessions) addMonth(r.ended_at, sessionRevenue(r, durations).total);
  for (const b of monthBookings) addMonth(b.starts_at, Number(b.amount));
  for (const v of monthVouchers) addMonth(v.created_at, Number(v.sold_price));
  let topRevenueMonth = null;
  for (const [month, amount] of monthMap) {
    if (!topRevenueMonth || amount > topRevenueMonth.amount) topRevenueMonth = { month, amount };
  }

  // Top income source in the selected period.
  const topIncomeSource = revenueBreakdown
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0] || null;

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
    top_revenue_day: topRevenueDay,
    top_revenue_month: topRevenueMonth,
    top_income_source: topIncomeSource,
    weekly,
    revenueBreakdown,
    expenses,
    expenseEntries: expenseRows.map((e) => ({ ...e, amount: Number(e.amount) })),
    txns,
    placeholder: { expenses: false, expense_transactions: false },
  };
}
