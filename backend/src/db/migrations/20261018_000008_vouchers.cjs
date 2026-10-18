/**
 * Gift vouchers. A voucher is one play session of a set duration for one child,
 * single use, sold (or given away) by the manager and redeemed at reception by
 * scanning its QR code or typing its short code.
 *
 * Sessions store no price — revenue is re-derived from `duration_minutes` — so a
 * redeemed visit carries its own `discount` (the duration price at the moment of
 * redemption). Finance subtracts it, and counts the voucher's `sold_price` as
 * income on the day it was sold instead, so the money is never counted twice.
 *
 * ADDITIVE only: production is live; existing sessions read as discount 0.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('vouchers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    // Short, typeable code printed under the QR (e.g. GV-7K3M9Q).
    t.string('code', 20).notNullable();
    // Opaque token the QR encodes as …/v/<token>; also the public gift-card link.
    t.string('token', 64).notNullable().unique();
    t.integer('duration_minutes').notNullable();
    // What the buyer paid (0 = a free gift from the centre). Income on the sale day.
    t.decimal('sold_price', 12, 2).notNullable().defaultTo(0);
    t.string('recipient_name', 120).nullable();
    t.string('buyer_name', 120).nullable();
    t.string('buyer_phone', 32).nullable();
    t.text('note').nullable();
    // Last valid day (Riyadh calendar date); null = never expires.
    t.date('expires_on').nullable();
    t.enu('status', ['active', 'redeemed', 'void']).notNullable().defaultTo('active');
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('redeemed_at', { useTz: true }).nullable();
    t.uuid('redeemed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.uuid('redeemed_session_id').nullable().references('id').inTable('sessions').onDelete('SET NULL');
    t.timestamp('voided_at', { useTz: true }).nullable();
    t.unique(['tenant_id', 'code']);
    t.index(['tenant_id', 'created_at']);
  });
  await knex.raw('alter table vouchers add constraint vouchers_sold_price_nonneg check (sold_price >= 0)');

  await knex.schema.alterTable('sessions', (t) => {
    t.uuid('voucher_id').nullable().references('id').inTable('vouchers').onDelete('SET NULL');
    t.decimal('discount', 12, 2).notNullable().defaultTo(0);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.alterTable('sessions', (t) => {
    t.dropColumn('voucher_id');
    t.dropColumn('discount');
  });
  await knex.schema.dropTableIfExists('vouchers');
};
