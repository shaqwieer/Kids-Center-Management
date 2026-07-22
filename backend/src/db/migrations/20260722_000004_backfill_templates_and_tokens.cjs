/**
 * Data backfill for an EXISTING install (the schema migration before this one
 * only adds columns — it cannot fix rows that were already there).
 *
 * Two things would otherwise be silently broken after deploying to a live
 * centre, and neither shows up in a fresh-database test:
 *
 *  1. `settings.wa_templates` already exists, so the new DEFAULTS in
 *     settings.service.js never apply to it. Without this, the `review`
 *     template is missing entirely (the worker would send a blank message)
 *     and `warn_5` has no {link}, so the mother never sees the
 *     "add an hour" prompt the feature exists to deliver.
 *
 *  2. Sessions that were already running have no `guest_token`, so the
 *     warning message for children currently playing could not link anywhere.
 *
 * Both patches are conservative: a template the centre has customised is left
 * exactly as written.
 */

const REVIEW_DEFAULT = {
  ar: 'شكراً لزيارتكم {المركز} 💛 ما رأيك في الزيارة؟ وكيف نخدمك بشكل أفضل؟\n{الرابط}',
  en: 'Thank you for visiting {center} 💛 How was your visit, and how can we serve you better?\n{link}',
};

const EXTEND_LINE = {
  ar: '\nتبين تمديد ساعة إضافية؟ اضغطي هنا: {الرابط}',
  en: '\nWant to add another hour? Tap here: {link}',
};

const hasLink = (s) => typeof s === 'string' && (s.includes('{link}') || s.includes('{الرابط}'));

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const rows = await knex('settings').select('tenant_id', 'wa_templates');

  for (const row of rows) {
    // jsonb comes back parsed; be tolerant of a text column just in case.
    const t = typeof row.wa_templates === 'string'
      ? JSON.parse(row.wa_templates || '{}')
      : (row.wa_templates || {});

    let changed = false;

    if (!t.review || (!t.review.ar && !t.review.en)) {
      t.review = { ...REVIEW_DEFAULT };
      changed = true;
    }

    // Append the invitation only when the template doesn't already offer a
    // link — re-running this must never stack the sentence twice.
    t.warn_5 = t.warn_5 || { ar: '', en: '' };
    for (const lang of ['ar', 'en']) {
      const body = t.warn_5[lang];
      if (body && body.trim() && !hasLink(body)) {
        t.warn_5[lang] = body.trimEnd() + EXTEND_LINE[lang];
        changed = true;
      }
    }

    if (changed) {
      // eslint-disable-next-line no-await-in-loop
      await knex('settings').where({ tenant_id: row.tenant_id })
        .update({ wa_templates: JSON.stringify(t), updated_at: knex.fn.now() });
    }
  }

  // Give every session still in flight a token, so a child playing across the
  // deploy still gets a working link in their 5-minute warning.
  await knex.raw(`
    update sessions
       set guest_token = replace(gen_random_uuid()::text, '-', '')
     where guest_token is null
       and status <> 'completed'
  `);
};

/**
 * Irreversible by design: this is a data backfill, and un-writing a centre's
 * message templates would be worse than leaving them. Rolling back the schema
 * migration drops the columns anyway.
 */
exports.down = async function down() {};
