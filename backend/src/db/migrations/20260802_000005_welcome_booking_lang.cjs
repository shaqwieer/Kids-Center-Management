/**
 * Two outbound messages that were configurable but never sendable, plus the
 * message language. Everything here is ADDITIVE — production is live.
 *
 *  - notifications : `session_id` becomes nullable and gains `customer_id` /
 *                    `booking_id`. A welcome is sent at REGISTRATION, when no
 *                    session exists; a confirmation belongs to a BOOKING. The
 *                    type check gains 'welcome' ('booking_confirmed' was
 *                    already allowed by migration 003 but had no sender).
 *  - customers     : `lang` — the language SHE registered in, so her messages
 *                    match the form she filled. Null = use the centre default.
 *  - settings      : `default_lang` — the centre-wide fallback, replacing the
 *                    'ar' that was hardcoded in the worker.
 *
 * The two new uniques are deliberately PLAIN, not partial. NULLs are distinct
 * in Postgres, so a session-scoped row (customer_id null) never collides with
 * another, while `onConflict(['customer_id','type'])` still has a constraint to
 * infer — a partial index would make that ON CONFLICT fail at runtime.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable('notifications', (t) => {
    t.uuid('customer_id').nullable().references('id').inTable('customers').onDelete('CASCADE');
    t.uuid('booking_id').nullable().references('id').inTable('bookings').onDelete('CASCADE');
  });
  await knex.raw('alter table notifications alter column session_id drop not null');

  await knex.raw(`
    alter table notifications
      add constraint notifications_customer_type_unique unique (customer_id, type)
  `);
  await knex.raw(`
    alter table notifications
      add constraint notifications_booking_type_unique unique (booking_id, type)
  `);

  // Exactly one anchor per row — a notification that belongs to nothing could
  // never be looked up, and one that belongs to two could be sent twice.
  await knex.raw(`
    alter table notifications add constraint notifications_one_anchor check (
      (case when session_id  is not null then 1 else 0 end)
    + (case when customer_id is not null then 1 else 0 end)
    + (case when booking_id  is not null then 1 else 0 end) = 1
    )
  `);

  await knex.raw('alter table notifications drop constraint if exists notifications_type_check');
  await knex.raw(`
    alter table notifications add constraint notifications_type_check
    check (type in ('warn_5','time_up','late','review','booking_confirmed','welcome'))
  `);

  await knex.schema.alterTable('customers', (t) => {
    t.string('lang', 2).nullable();
  });
  await knex.raw(`
    alter table customers add constraint customers_lang_check
    check (lang is null or lang in ('ar','en'))
  `);

  await knex.schema.alterTable('settings', (t) => {
    t.string('default_lang', 2).notNullable().defaultTo('ar');
  });
  await knex.raw(`
    alter table settings add constraint settings_default_lang_check
    check (default_lang in ('ar','en'))
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw('alter table settings drop constraint if exists settings_default_lang_check');
  await knex.schema.alterTable('settings', (t) => { t.dropColumn('default_lang'); });

  await knex.raw('alter table customers drop constraint if exists customers_lang_check');
  await knex.schema.alterTable('customers', (t) => { t.dropColumn('lang'); });

  await knex.raw('alter table notifications drop constraint if exists notifications_type_check');
  await knex.raw(`
    alter table notifications add constraint notifications_type_check
    check (type in ('warn_5','time_up','late','review','booking_confirmed'))
  `);
  await knex.raw('alter table notifications drop constraint if exists notifications_one_anchor');
  await knex.raw('alter table notifications drop constraint if exists notifications_customer_type_unique');
  await knex.raw('alter table notifications drop constraint if exists notifications_booking_type_unique');

  // session_id can only go back to NOT NULL once the rows that have no session
  // are gone — they are exactly the welcome/booking rows this migration added.
  await knex('notifications').whereNull('session_id').del();
  await knex.raw('alter table notifications alter column session_id set not null');

  await knex.schema.alterTable('notifications', (t) => {
    t.dropColumn('customer_id');
    t.dropColumn('booking_id');
  });
};
