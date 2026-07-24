/**
 * Excel (.xlsx) reporting. Builds a real multi-sheet workbook from live rows —
 * visits, customers & children, parties/workshops, expenses, reviews — plus a
 * Summary sheet carrying the analytical figures.
 *
 * Sheets are written right-to-left when the caller asks for Arabic, so the
 * workbook opens the way the manager reads.
 */
import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';
import { db } from '../../config/db.js';
import { ZONE } from '../../utils/time.js';
import { priceForDuration } from '../../lib/timing.js';
import { getSettings } from '../settings/settings.service.js';
import { insights } from '../analytics/analytics.service.js';

export const REPORT_TYPES = ['full', 'sessions', 'customers', 'bookings', 'expenses', 'reviews'];

const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97A53' } };

const T = {
  ar: {
    summary: 'الملخص',
    sessions: 'الزيارات',
    customers: 'العملاء',
    children: 'الأطفال',
    bookings: 'الحجوزات',
    expenses: 'المصروفات',
    reviews: 'التقييمات',
    metric: 'المؤشر',
    value: 'القيمة',
    date: 'التاريخ',
    child: 'الطفل',
    guardian: 'ولي الأمر',
    phone: 'الجوال',
    code: 'الرمز',
    duration: 'المدة (دقيقة)',
    played: 'اللعب الفعلي (دقيقة)',
    late_min: 'دقائق التأخير',
    late_fee: 'رسوم التأخير',
    price: 'السعر',
    total: 'الإجمالي',
    status: 'الحالة',
    started: 'البداية',
    ended: 'النهاية',
    children_count: 'عدد الأطفال',
    registered: 'تاريخ التسجيل',
    visits: 'عدد الزيارات',
    name: 'الاسم',
    birthdate: 'تاريخ الميلاد',
    age: 'العمر',
    gender: 'الجنس',
    allergy: 'حساسية',
    allergy_note: 'تفاصيل الحساسية',
    male: 'ذكر',
    female: 'أنثى',
    yes: 'نعم',
    no: 'لا',
    type: 'النوع',
    reference: 'المرجع',
    theme: 'الثيم',
    food: 'الضيافة',
    amount: 'المبلغ',
    paid: 'المدفوع',
    payment: 'حالة الدفع',
    notes: 'ملاحظات',
    title: 'البند',
    category: 'الفئة',
    rating: 'التقييم',
    comment: 'الملاحظة',
    submitted: 'تاريخ التقييم',
    party: 'حفلة',
    workshop: 'ورشة',
    period: 'الفترة',
    generated: 'تاريخ التقرير',
    revenue_play: 'دخل وقت اللعب',
    revenue_parties: 'دخل الحفلات',
    revenue_workshops: 'دخل ورش العمل',
    busiest_day: 'أكثر الأيام ازدحاماً',
    busiest_hour: 'أكثر الساعات ازدحاماً',
    total_sessions: 'إجمالي الزيارات',
    avg_duration: 'متوسط المدة (دقيقة)',
    new_customers: 'عملاء جدد',
    repeat_rate: 'نسبة العودة %',
    children_total: 'إجمالي الأطفال',
    allergy_count: 'أطفال لديهم حساسية',
    growth: 'نمو الإيراد الشهري %',
  },
  en: {
    summary: 'Summary',
    sessions: 'Visits',
    customers: 'Customers',
    children: 'Children',
    bookings: 'Bookings',
    expenses: 'Expenses',
    reviews: 'Reviews',
    metric: 'Metric',
    value: 'Value',
    date: 'Date',
    child: 'Child',
    guardian: 'Guardian',
    phone: 'Phone',
    code: 'Code',
    duration: 'Duration (min)',
    played: 'Actually played (min)',
    late_min: 'Late minutes',
    late_fee: 'Late fee',
    price: 'Price',
    total: 'Total',
    status: 'Status',
    started: 'Started',
    ended: 'Ended',
    children_count: 'Children',
    registered: 'Registered',
    visits: 'Visits',
    name: 'Name',
    birthdate: 'Birthdate',
    age: 'Age',
    gender: 'Gender',
    allergy: 'Allergy',
    allergy_note: 'Allergy details',
    male: 'Boy',
    female: 'Girl',
    yes: 'Yes',
    no: 'No',
    type: 'Type',
    reference: 'Reference',
    theme: 'Theme',
    food: 'Catering',
    amount: 'Amount',
    paid: 'Paid',
    payment: 'Payment',
    notes: 'Notes',
    title: 'Item',
    category: 'Category',
    rating: 'Rating',
    comment: 'Comment',
    submitted: 'Submitted',
    party: 'Party',
    workshop: 'Workshop',
    period: 'Period',
    generated: 'Generated',
    revenue_play: 'Play-time revenue',
    revenue_parties: 'Party revenue',
    revenue_workshops: 'Workshop revenue',
    busiest_day: 'Busiest day',
    busiest_hour: 'Busiest hour',
    total_sessions: 'Total visits',
    avg_duration: 'Average duration (min)',
    new_customers: 'New customers',
    repeat_rate: 'Repeat rate %',
    children_total: 'Children on file',
    allergy_count: 'Children with allergies',
    growth: 'Monthly revenue growth %',
  },
};

/** Riyadh-local display string; Excel gets a string so the timezone can't shift. */
const fmt = (d) => (d ? DateTime.fromJSDate(new Date(d)).setZone(ZONE).toFormat('yyyy-LL-dd HH:mm') : '');
const fmtDate = (d) => (d ? DateTime.fromJSDate(new Date(d)).setZone(ZONE).toFormat('yyyy-LL-dd') : '');

function addSheet(wb, name, columns, rows, rtl) {
  const ws = wb.addWorksheet(name, {
    views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }],
  });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 18 }));
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    cell.fill = HEAD_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(1).height = 22;
  rows.forEach((r) => ws.addRow(r));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

/**
 * @param {string} tenantId
 * @param {{type:string, start:Date, end:Date, lang:'ar'|'en'}} opts
 * @returns {Promise<{buffer:Buffer, filename:string}>}
 */
export async function buildReport(tenantId, { type = 'full', start, end, lang = 'ar', period = 'month' }) {
  const t = T[lang] || T.ar;
  const rtl = lang === 'ar';
  const settings = await getSettings(tenantId);
  const durations = settings.durations;
  const money = `${settings.currency}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = settings.center_name;
  wb.created = new Date();

  const want = (sheet) => type === 'full' || type === sheet;

  // ---- Summary -------------------------------------------------------------
  if (want('summary') || type === 'full') {
    const a = await insights(tenantId, { period, lang });
    const src = Object.fromEntries(a.income_sources.map((s) => [s.key, s.amount]));
    const rows = [
      { metric: t.period, value: `${fmtDate(start)} → ${fmtDate(end)}` },
      { metric: t.generated, value: fmt(new Date()) },
      { metric: t.total_sessions, value: a.kpis.sessions },
      { metric: `${t.revenue_play} (${money})`, value: src.play ?? 0 },
      { metric: `${t.revenue_parties} (${money})`, value: src.parties ?? 0 },
      { metric: `${t.revenue_workshops} (${money})`, value: src.workshops ?? 0 },
      { metric: t.busiest_day, value: `${a.busiest_day.label} (${a.busiest_day.count})` },
      { metric: t.busiest_hour, value: `${String(a.busiest_hour.hour).padStart(2, '0')}:00 (${a.busiest_hour.count})` },
      { metric: t.avg_duration, value: a.kpis.avg_duration_minutes },
      { metric: t.new_customers, value: a.kpis.new_customers },
      { metric: t.repeat_rate, value: a.kpis.repeat_rate_pct },
      { metric: t.children_total, value: a.kpis.children_total },
      { metric: t.allergy_count, value: a.kpis.children_with_allergy },
      { metric: t.growth, value: a.trend.growth_pct ?? '—' },
    ];
    addSheet(wb, t.summary, [
      { header: t.metric, key: 'metric', width: 34 },
      { header: t.value, key: 'value', width: 28 },
    ], rows, rtl);
  }

  // ---- Visits --------------------------------------------------------------
  if (want('sessions')) {
    const rows = await db('sessions as s')
      .join('children as ch', 'ch.id', 's.child_id')
      .join('customers as c', 'c.id', 's.customer_id')
      .where('s.tenant_id', tenantId)
      .andWhereBetween('s.started_at', [start, end])
      .orderBy('s.started_at', 'desc')
      .select(
        's.started_at', 's.ended_at', 's.duration_minutes', 's.late_minutes', 's.late_fee', 's.status',
        'ch.name as child_name', 'ch.birthdate', 'ch.age', 'ch.has_allergy', 'ch.allergy_note',
        'c.full_name as guardian', 'c.phone', 'c.customer_code',
      );
    addSheet(wb, t.sessions, [
      { header: t.started, key: 'started', width: 18 },
      { header: t.ended, key: 'ended', width: 18 },
      { header: t.child, key: 'child', width: 20 },
      { header: t.birthdate, key: 'birthdate', width: 14 },
      { header: t.age, key: 'age', width: 8 },
      { header: t.guardian, key: 'guardian', width: 22 },
      { header: t.phone, key: 'phone', width: 15 },
      { header: t.allergy, key: 'allergy', width: 10 },
      { header: t.allergy_note, key: 'allergy_note', width: 30 },
      { header: t.code, key: 'code', width: 12 },
      { header: t.duration, key: 'duration', width: 14 },
      { header: t.played, key: 'played', width: 18 },
      { header: t.late_min, key: 'late_min', width: 13 },
      { header: `${t.late_fee} (${money})`, key: 'late_fee', width: 14 },
      { header: `${t.price} (${money})`, key: 'price', width: 12 },
      { header: `${t.total} (${money})`, key: 'total', width: 13 },
      { header: t.status, key: 'status', width: 12 },
    ], rows.map((r) => {
      const price = priceForDuration(durations, r.duration_minutes);
      const late = Number(r.late_fee) || 0;
      const played = r.ended_at
        ? Math.max(0, Math.round((new Date(r.ended_at) - new Date(r.started_at)) / 60000))
        : null;
      return {
        started: fmt(r.started_at),
        ended: fmt(r.ended_at),
        child: r.child_name,
        birthdate: fmtDate(r.birthdate),
        age: r.age,
        guardian: r.guardian,
        phone: r.phone,
        allergy: r.has_allergy ? t.yes : t.no,
        allergy_note: r.allergy_note || '',
        code: r.customer_code,
        duration: r.duration_minutes,
        played,
        late_min: r.late_minutes,
        late_fee: late,
        price,
        total: price + late,
        status: r.status,
      };
    }), rtl);
  }

  // ---- Customers + children ------------------------------------------------
  if (want('customers')) {
    const custs = await db('customers as c')
      .leftJoin('sessions as s', 's.customer_id', 'c.id')
      .where('c.tenant_id', tenantId)
      .groupBy('c.id')
      .select('c.id', 'c.full_name', 'c.phone', 'c.customer_code', 'c.created_at')
      .count('s.id as visits')
      .orderBy('c.created_at', 'desc');
    addSheet(wb, t.customers, [
      { header: t.name, key: 'name', width: 24 },
      { header: t.phone, key: 'phone', width: 16 },
      { header: t.code, key: 'code', width: 12 },
      { header: t.visits, key: 'visits', width: 12 },
      { header: t.registered, key: 'registered', width: 18 },
    ], custs.map((c) => ({
      name: c.full_name,
      phone: c.phone,
      code: c.customer_code,
      visits: Number(c.visits),
      registered: fmt(c.created_at),
    })), rtl);

    const kids = await db('children as ch')
      .join('customers as c', 'c.id', 'ch.customer_id')
      .where('c.tenant_id', tenantId)
      .orderBy('c.full_name', 'asc')
      .select('ch.name', 'ch.birthdate', 'ch.age', 'ch.gender', 'ch.has_allergy', 'ch.allergy_note',
        'c.full_name as guardian', 'c.phone');
    addSheet(wb, t.children, [
      { header: t.name, key: 'name', width: 22 },
      { header: t.birthdate, key: 'birthdate', width: 14 },
      { header: t.age, key: 'age', width: 8 },
      { header: t.gender, key: 'gender', width: 10 },
      { header: t.allergy, key: 'allergy', width: 10 },
      { header: t.allergy_note, key: 'allergy_note', width: 34 },
      { header: t.guardian, key: 'guardian', width: 22 },
      { header: t.phone, key: 'phone', width: 16 },
    ], kids.map((k) => ({
      name: k.name,
      birthdate: fmtDate(k.birthdate),
      age: k.age,
      gender: k.gender === 'm' ? t.male : (k.gender === 'f' ? t.female : ''),
      allergy: k.has_allergy ? t.yes : t.no,
      allergy_note: k.allergy_note || '',
      guardian: k.guardian,
      phone: k.phone,
    })), rtl);
  }

  // ---- Parties & workshops -------------------------------------------------
  if (want('bookings')) {
    const rows = await db('bookings')
      .where({ tenant_id: tenantId })
      .andWhereBetween('starts_at', [start, end])
      .orderBy('starts_at', 'desc');
    const themes = settings.booking_config?.themes || [];
    const foods = settings.booking_config?.foods || [];
    const lbl = (list, key) => list.find((x) => x.key === key)?.[lang] || key || '';
    addSheet(wb, t.bookings, [
      { header: t.reference, key: 'reference', width: 12 },
      { header: t.type, key: 'type', width: 12 },
      { header: t.started, key: 'starts', width: 18 },
      { header: t.guardian, key: 'guardian', width: 22 },
      { header: t.phone, key: 'phone', width: 16 },
      { header: t.children_count, key: 'children', width: 12 },
      { header: t.theme, key: 'theme', width: 16 },
      { header: t.food, key: 'food', width: 16 },
      { header: `${t.amount} (${money})`, key: 'amount', width: 14 },
      { header: `${t.paid} (${money})`, key: 'paid', width: 14 },
      { header: t.status, key: 'status', width: 12 },
      { header: t.payment, key: 'payment', width: 12 },
      { header: t.notes, key: 'notes', width: 30 },
    ], rows.map((b) => ({
      reference: b.reference,
      type: b.type === 'party' ? t.party : t.workshop,
      starts: fmt(b.starts_at),
      guardian: b.guardian_name,
      phone: b.phone,
      children: b.children_count,
      theme: lbl(themes, b.theme),
      food: lbl(foods, b.food),
      amount: Number(b.amount),
      paid: Number(b.paid_amount),
      status: b.status,
      payment: b.payment_status,
      notes: b.notes || '',
    })), rtl);
  }

  // ---- Expenses ------------------------------------------------------------
  if (want('expenses')) {
    const rows = await db('expenses')
      .where({ tenant_id: tenantId })
      .andWhereBetween('incurred_at', [start, end])
      .orderBy('incurred_at', 'desc');
    addSheet(wb, t.expenses, [
      { header: t.date, key: 'date', width: 18 },
      { header: t.title, key: 'title', width: 30 },
      { header: t.category, key: 'category', width: 16 },
      { header: `${t.amount} (${money})`, key: 'amount', width: 14 },
      { header: t.notes, key: 'notes', width: 34 },
    ], rows.map((e) => ({
      date: fmt(e.incurred_at),
      title: e.title,
      category: e.category,
      amount: Number(e.amount),
      notes: e.notes || '',
    })), rtl);
  }

  // ---- Reviews -------------------------------------------------------------
  if (want('reviews')) {
    const rows = await db('reviews as r')
      .leftJoin('sessions as s', 's.id', 'r.session_id')
      .leftJoin('children as ch', 'ch.id', 's.child_id')
      .leftJoin('customers as c', 'c.id', 'r.customer_id')
      .where('r.tenant_id', tenantId)
      .whereNotNull('r.submitted_at')
      .andWhereBetween('r.submitted_at', [start, end])
      .orderBy('r.submitted_at', 'desc')
      .select('r.rating', 'r.comment', 'r.submitted_at', 'ch.name as child_name', 'c.full_name as guardian');
    addSheet(wb, t.reviews, [
      { header: t.submitted, key: 'submitted', width: 18 },
      { header: t.rating, key: 'rating', width: 10 },
      { header: t.child, key: 'child', width: 20 },
      { header: t.guardian, key: 'guardian', width: 22 },
      { header: t.comment, key: 'comment', width: 60 },
    ], rows.map((r) => ({
      submitted: fmt(r.submitted_at),
      rating: r.rating,
      child: r.child_name || '',
      guardian: r.guardian || '',
      comment: r.comment || '',
    })), rtl);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = DateTime.now().setZone(ZONE).toFormat('yyyy-LL-dd');
  return { buffer: Buffer.from(buffer), filename: `farfasha-${type}-${stamp}.xlsx` };
}
