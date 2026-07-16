/** Timezone helpers (Asia/Riyadh). Storage is UTC; these are for boundaries/display. */
import { DateTime } from 'luxon';
import { env } from '../config/env.js';

export const ZONE = env.tz || 'Asia/Riyadh';

export function now() {
  return new Date();
}

/** Start/end of the current day/week/month IN Riyadh, returned as UTC Date objects. */
export function periodRange(period, ref = new Date()) {
  const d = DateTime.fromJSDate(ref, { zone: ZONE });
  let start;
  let end;
  switch (period) {
    case 'today':
      start = d.startOf('day');
      end = d.endOf('day');
      break;
    case 'week':
      // Week starts Sunday in KSA convention.
      start = d.startOf('week').minus({ days: 1 });
      end = start.plus({ days: 6 }).endOf('day');
      break;
    case 'month':
    default:
      start = d.startOf('month');
      end = d.endOf('month');
      break;
  }
  return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate() };
}

/** The 7 day-boundaries (UTC) for the trailing week ending today, oldest first. */
export function trailingWeekDays(ref = new Date()) {
  const today = DateTime.fromJSDate(ref, { zone: ZONE }).startOf('day');
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = today.minus({ days: i });
    out.push({
      start: day.toUTC().toJSDate(),
      end: day.endOf('day').toUTC().toJSDate(),
      weekday: day.weekday % 7, // luxon: 1=Mon..7=Sun -> 0=Sun..6=Sat
    });
  }
  return out;
}
