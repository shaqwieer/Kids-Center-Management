/**
 * Data backfill for an EXISTING install. `getSettings` returns the stored row
 * as-is — it does NOT merge in the DEFAULTS from settings.service.js — so a
 * centre that already has a settings row would never see any of this.
 *
 * Three fixes, all conservative (a sentence the centre rewrote itself is left
 * exactly as written):
 *
 *  1. `booking_confirmed` did not exist as a template at all. Its sender is new
 *     in this release; without the text the worker would skip every send.
 *
 *  2. `warn_5` hardcoded the extension length ("نصف ساعة" / "another hour")
 *     while `guardian_extend_minutes` is a setting. Change the setting and the
 *     message lied. The phrase becomes {الدقائق}/{minutes}, substituted IN
 *     PLACE so the invitation and its link stay on one line — that is what lets
 *     stripPlaceholderLines() drop the whole offer when there is no link.
 *
 *  3. `time_up` said "الوقت الإضافي حتى الآن: {الدقائق} دقيقة" / "Overtime so
 *     far: {minutes} minutes". Overtime is computed when the job FIRES, i.e. at
 *     the exact end of the session, so that number was always 0 or 1 — the
 *     wording promised a running total it could never show.
 *
 *  4. Templates that spell the centre's name out instead of using {المركز}.
 *     Same class of bug: `center_name` is a setting, so a rebrand left the
 *     messages introducing the centre by its old name — which is exactly what
 *     the never-sent welcome message still did after the Blend rebrand.
 */

const BOOKING_CONFIRMED_DEFAULT = {
  ar: 'تم تأكيد حجزك في {المركز} 🎉\nرقم الحجز: {المرجع}\nالتاريخ: {التاريخ} الساعة {الوقت}\nعدد الأطفال: {العدد}\nالمبلغ: {المبلغ}\nبانتظاركم! 💛',
  en: 'Your booking at {center} is confirmed 🎉\nReference: {ref}\nDate: {date} at {time}\nChildren: {count}\nAmount: {amount}\nSee you soon! 💛',
};

const TIME_UP_DEFAULT = {
  ar: 'انتهى وقت لعب {الطفل} 🕐\nنرجو التوجّه إلى الاستقبال — أي وقت إضافي يبدأ احتسابه من الآن.',
  en: '{child}\'s play time is up 🕐\nPlease come to reception — any extra time is counted from now.',
};

/** Fixed-length wording that must become the {minutes} placeholder. */
const EXTEND_PHRASES = {
  ar: [
    [/تمديد\s+نصف\s+ساعة\s+إضافية/g, 'تمديد {الدقائق} دقيقة إضافية'],
    [/تمديد\s+ساعة\s+إضافية/g, 'تمديد {الدقائق} دقيقة إضافية'],
  ],
  en: [
    [/add\s+30\s+more\s+minutes/gi, 'add {minutes} more minutes'],
    [/add\s+another\s+hour/gi, 'add {minutes} more minutes'],
  ],
};

/** The misleading running-total sentence, in every form we ever shipped. */
const OVERTIME_TOTAL = {
  ar: /الوقت\s+الإضافي\s+حتى\s+الآن/,
  en: /overtime\s+so\s+far/i,
};

const hasMinutes = (s) => typeof s === 'string' && (s.includes('{minutes}') || s.includes('{الدقائق}'));
const blank = (s) => !s || !String(s).trim();

/** Brands this codebase has shipped under, plus whatever the centre is called now. */
const LEGACY_NAMES = ['Blend Play & Sip', 'فرفشة', 'Farfasha'];
const CENTER_TOKEN = { ar: '{المركز}', en: '{center}' };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Swap a spelled-out centre name for the placeholder that tracks the setting. */
function placeholderiseCenter(body, lang, centerName) {
  if (blank(body)) return body;
  const names = [centerName, ...LEGACY_NAMES]
    .filter((n) => n && String(n).trim())
    // Longest first: "Blend Play & Sip" must not be half-matched by a shorter name.
    .sort((a, b) => b.length - a.length);
  let out = body;
  for (const name of names) {
    out = out.replace(new RegExp(escapeRe(String(name).trim()), 'g'), CENTER_TOKEN[lang]);
  }
  return out;
}

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const rows = await knex('settings').select('tenant_id', 'center_name', 'wa_templates');

  for (const row of rows) {
    // jsonb comes back parsed; be tolerant of a text column just in case.
    const t = typeof row.wa_templates === 'string'
      ? JSON.parse(row.wa_templates || '{}')
      : (row.wa_templates || {});

    let changed = false;

    // 1. booking_confirmed — add only when there is nothing to lose.
    if (!t.booking_confirmed || (blank(t.booking_confirmed.ar) && blank(t.booking_confirmed.en))) {
      t.booking_confirmed = { ...BOOKING_CONFIRMED_DEFAULT };
      changed = true;
    }

    // 2. warn_5 — swap the fixed duration for the placeholder, in place.
    t.warn_5 = t.warn_5 || { ar: '', en: '' };
    for (const lang of ['ar', 'en']) {
      const body = t.warn_5[lang];
      if (blank(body) || hasMinutes(body)) continue; // eslint-disable-line no-continue
      let next = body;
      for (const [re, replacement] of EXTEND_PHRASES[lang]) next = next.replace(re, replacement);
      if (next !== body) {
        t.warn_5[lang] = next;
        changed = true;
      }
    }

    // 3. time_up — only when it still carries the running-total claim.
    t.time_up = t.time_up || { ar: '', en: '' };
    for (const lang of ['ar', 'en']) {
      const body = t.time_up[lang];
      if (blank(body)) {
        t.time_up[lang] = TIME_UP_DEFAULT[lang];
        changed = true;
      } else if (OVERTIME_TOTAL[lang].test(body)) {
        t.time_up[lang] = TIME_UP_DEFAULT[lang];
        changed = true;
      }
    }

    // 4. Any template that names the centre literally — after the three fixes
    //    above, so the replacements they wrote in get the same treatment.
    for (const key of ['welcome', 'warn_5', 'time_up', 'review', 'booking_confirmed']) {
      if (!t[key]) continue; // eslint-disable-line no-continue
      for (const lang of ['ar', 'en']) {
        const next = placeholderiseCenter(t[key][lang], lang, row.center_name);
        if (next !== t[key][lang]) {
          t[key][lang] = next;
          changed = true;
        }
      }
    }

    if (changed) {
      // eslint-disable-next-line no-await-in-loop
      await knex('settings').where({ tenant_id: row.tenant_id })
        .update({ wa_templates: JSON.stringify(t), updated_at: knex.fn.now() });
    }
  }
};

/**
 * Irreversible by design, like the 000004 backfill: un-writing a centre's
 * message templates would be worse than leaving them. Rolling back 000005 drops
 * the columns these messages depend on anyway.
 */
exports.down = async function down() {};
