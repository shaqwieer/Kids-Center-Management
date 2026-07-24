/**
 * Time/format helpers. The countdown is derived PURELY from the server's
 * `ends_at` — the client clock is never trusted for notifications, only for the
 * smooth visual tick.
 */
export const ZONE = 'Asia/Riyadh';
const WARN_MS = 5 * 60_000;

export function remainingMs(endsAt, now = Date.now()) {
  return new Date(endsAt).getTime() - now;
}

/** playing | warning | overtime — derived from remaining time. */
export function liveState(endsAt, now = Date.now()) {
  const r = remainingMs(endsAt, now);
  if (r <= 0) return 'overtime';
  if (r <= WARN_MS) return 'warning';
  return 'playing';
}

/**
 * { sign, hh, mm, ss, text, over } for the countdown (counts up when overtime).
 * Always keeps the ticking seconds so the live counter visibly moves; past an
 * hour it rolls the minutes into "h:mm:ss" so the figure stays bounded (not an
 * unbounded "1397:51") instead of dropping the seconds and looking frozen.
 */
export function countdown(endsAt, now = Date.now()) {
  const r = remainingMs(endsAt, now);
  const abs = Math.abs(r);
  const hh = Math.floor(abs / 3_600_000);
  const mm = Math.floor((abs % 3_600_000) / 60_000);
  const ss = Math.floor((abs % 60_000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    sign: r < 0 ? '+' : '',
    hh, mm, ss,
    text: hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`,
    over: r < 0,
  };
}

/** Fraction of time remaining (0..1) for the progress ring. */
export function progressFraction(startedAt, endsAt, now = Date.now()) {
  const total = new Date(endsAt).getTime() - new Date(startedAt).getTime();
  if (total <= 0) return 0;
  const rem = new Date(endsAt).getTime() - now;
  return Math.max(0, Math.min(1, rem / total));
}

/** Wall-clock time in Riyadh (e.g. "1:20 PM" / "١:٢٠ م"). */
export function formatTime(ts, lang = 'ar', clock24 = false) {
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE, hour: 'numeric', minute: '2-digit', hour12: !clock24,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  const hour = get('hour');
  const minute = get('minute');
  if (clock24) return `${hour}:${minute}`;
  const dayPeriod = get('dayPeriod');
  const ap = lang === 'ar' ? (dayPeriod === 'AM' ? 'ص' : 'م') : dayPeriod;
  return `${hour}:${minute} ${ap}`;
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const AR_WD_SHORT = { Sun: 'الأحد', Mon: 'الاثنين', Tue: 'الثلاثاء', Wed: 'الأربعاء', Thu: 'الخميس', Fri: 'الجمعة', Sat: 'السبت' };

/** Header date label, in Riyadh. */
export function dateLabel(lang = 'ar', ts = Date.now()) {
  const d = new Date(ts);
  if (lang === 'ar') {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short', day: 'numeric', month: 'numeric' }).formatToParts(d);
    const day = p.find((x) => x.type === 'day')?.value;
    const month = Number(p.find((x) => x.type === 'month')?.value) - 1;
    const wdShort = p.find((x) => x.type === 'weekday')?.value;
    return `${AR_WD_SHORT[wdShort] || ''}، ${day} ${AR_MONTHS[month]}`;
  }
  return new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

/** Localised full date (visit history). */
export function formatDate(iso, lang = 'ar') {
  const d = new Date(iso);
  if (lang === 'ar') {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
    const day = p.find((x) => x.type === 'day')?.value;
    const month = Number(p.find((x) => x.type === 'month')?.value) - 1;
    const year = p.find((x) => x.type === 'year')?.value;
    return `${day} ${AR_MONTHS[month]} ${year}`;
  }
  return new Intl.DateTimeFormat('en-US', { timeZone: ZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/** Currency formatting matching the design (SAR / ر.س). */
export function money(n, lang = 'ar', currency = 'SAR') {
  const s = Math.round(Number(n) || 0).toLocaleString('en-US');
  if (currency === 'SAR') return lang === 'ar' ? `${s} ر.س` : `SAR ${s}`;
  return `${s} ${currency}`;
}

/**
 * Party/workshop slot as an hour range in Riyadh — e.g. "1–4 PM" / "١–٤ م" —
 * built from the slot's real start/end so it always matches the booked window.
 */
export function slotLabel(startsAt, endsAt, lang = 'ar') {
  const parse = (ts) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ZONE, hour: 'numeric', minute: '2-digit', hour12: true,
    }).formatToParts(new Date(ts));
    const get = (t) => parts.find((p) => p.type === t)?.value || '';
    return { hour: get('hour'), minute: get('minute'), ap: get('dayPeriod') };
  };
  const a = parse(startsAt);
  const b = parse(endsAt);
  const h = (x) => (x.minute === '00' ? x.hour : `${x.hour}:${x.minute}`);
  const ap = (p) => (lang === 'ar' ? (p === 'AM' ? 'ص' : 'م') : p);
  // Collapse to one period label when both ends sit in the same half-day.
  if (a.ap === b.ap) return `${h(a)}–${h(b)} ${ap(a.ap)}`;
  return `${h(a)} ${ap(a.ap)} – ${h(b)} ${ap(b.ap)}`;
}

/** Duration label (30 -> "30 min"/"٣٠ دقيقة", etc.) via i18n keys. */
export function durationKey(min) {
  if (min === 30) return 'dur30';
  if (min === 60) return 'dur60';
  if (min === 120) return 'dur120';
  return null;
}
