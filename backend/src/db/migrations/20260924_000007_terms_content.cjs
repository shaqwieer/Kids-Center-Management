/**
 * The centre's own terms page. Until now the consent statement could only link
 * OUT to a URL the centre hosted somewhere else; most centres have no such page,
 * so the terms are now written in Settings and served at /terms.
 *
 * ADDITIVE and nullable with no default — production is live, and an existing
 * settings row simply reads as "no terms written yet" (the consent line then
 * falls back to `terms_url`, or shows no link at all).
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable('settings', (t) => {
    t.text('terms_ar').nullable();
    t.text('terms_en').nullable();
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.alterTable('settings', (t) => {
    t.dropColumn('terms_ar');
    t.dropColumn('terms_en');
  });
};
