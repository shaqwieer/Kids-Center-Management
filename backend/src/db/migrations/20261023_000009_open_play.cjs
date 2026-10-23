/**
 * Open play replaces the 2-hour option (client request, Oct 2026): reception
 * now sells 30 min, 1 hour and "open play" — no fixed length, the child plays
 * until checkout.
 *
 * 1. sessions.ends_at becomes nullable. An open-play session is stored as
 *    duration_minutes = 0 with ends_at NULL: no warn/time-up jobs, no
 *    overtime, no late fee. Existing rows are untouched.
 *
 * 2. The live settings row: the 120-min tier is RETIRED, not deleted. Revenue
 *    is re-derived from duration_minutes against this list, so dropping it
 *    would price every past (and still-running) 2-hour visit at 0. An open-play
 *    tier is appended at the 2-hour price, for the manager to adjust.
 *
 * Idempotent: a row that already has an open-play tier is left alone.
 */

const OPEN = 0;
const RETIRE = 120;

const parse = (v) => (typeof v === 'string' ? JSON.parse(v || '[]') : (v || []));

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE sessions ALTER COLUMN ends_at DROP NOT NULL');

  const rows = await knex('settings').select('tenant_id', 'durations');
  for (const row of rows) {
    const durations = parse(row.durations);
    if (!Array.isArray(durations) || durations.some((d) => Number(d.min) === OPEN)) continue; // eslint-disable-line no-continue

    const twoHours = durations.find((d) => Number(d.min) === RETIRE);
    const openPrice = twoHours
      ? Number(twoHours.price) || 0
      : Math.max(0, ...durations.map((d) => Number(d.price) || 0));

    const next = durations.map((d) => (Number(d.min) === RETIRE ? { ...d, retired: true } : d));
    next.push({ min: OPEN, price: openPrice });

    // eslint-disable-next-line no-await-in-loop
    await knex('settings').where({ tenant_id: row.tenant_id }).update({ durations: JSON.stringify(next) });
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  const rows = await knex('settings').select('tenant_id', 'durations');
  for (const row of rows) {
    const durations = parse(row.durations);
    if (!Array.isArray(durations)) continue; // eslint-disable-line no-continue
    const next = durations
      .filter((d) => Number(d.min) !== OPEN)
      .map(({ retired, ...d }) => d); // eslint-disable-line no-unused-vars
    // eslint-disable-next-line no-await-in-loop
    await knex('settings').where({ tenant_id: row.tenant_id }).update({ durations: JSON.stringify(next) });
  }

  // Open-play visits get a zero-length window so the NOT NULL can come back.
  await knex.raw('UPDATE sessions SET ends_at = COALESCE(ended_at, started_at) WHERE ends_at IS NULL');
  await knex.raw('ALTER TABLE sessions ALTER COLUMN ends_at SET NOT NULL');
};
