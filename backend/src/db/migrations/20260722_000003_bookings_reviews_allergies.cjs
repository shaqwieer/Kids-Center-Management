/**
 * Growth migration — everything is ADDITIVE (the production DB is live):
 *
 *  - children      : allergy flag + free-text note (medical safety info)
 *  - settings      : terms link, booking/party config, review + guardian-extend toggles
 *  - sessions      : guest_token (opaque link the mother uses to self-extend)
 *                    guardian_added_minutes (how much SHE added, for the ledger)
 *  - bookings      : parties & workshops — the second and third income sources.
 *                    Double-booking is prevented by a real Postgres EXCLUSION
 *                    constraint on the time range, not by application checks.
 *  - reviews       : post-visit rating collected over an opaque public link
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  // Needed for the `tenant_id WITH =` part of the booking exclusion constraint:
  // plain gist can't index equality on a uuid without btree_gist.
  await knex.raw('create extension if not exists btree_gist');

  await knex.schema.alterTable('children', (t) => {
    t.boolean('has_allergy').notNullable().defaultTo(false);
    t.text('allergy_note').nullable();
  });

  await knex.schema.alterTable('settings', (t) => {
    t.string('terms_url', 500).nullable();
    t.jsonb('booking_config').notNullable().defaultTo(JSON.stringify({
      party: {
        enabled: true,
        base_price: 500,
        price_per_child: 35,
        min_children: 5,
        max_children: 40,
        duration_minutes: 120,
        slots: ['12:00', '15:00', '18:00'],
        lead_hours: 24,
      },
      workshop: {
        enabled: true,
        base_price: 0,
        price_per_child: 60,
        min_children: 1,
        max_children: 20,
        duration_minutes: 90,
        slots: ['10:00', '16:00'],
        lead_hours: 24,
      },
      themes: [
        { key: 'princess', ar: 'أميرات', en: 'Princess' },
        { key: 'superhero', ar: 'أبطال خارقون', en: 'Superheroes' },
        { key: 'jungle', ar: 'أدغال', en: 'Jungle' },
        { key: 'space', ar: 'فضاء', en: 'Space' },
        { key: 'candy', ar: 'حلويات', en: 'Candy' },
      ],
      foods: [
        { key: 'none', ar: 'بدون ضيافة', en: 'No catering', price_per_child: 0 },
        { key: 'light', ar: 'ضيافة خفيفة', en: 'Light snacks', price_per_child: 15 },
        { key: 'full', ar: 'بوفيه كامل', en: 'Full buffet', price_per_child: 45 },
        { key: 'cake_only', ar: 'كيكة فقط', en: 'Cake only', price_per_child: 10 },
      ],
    }));
    t.boolean('reviews_enabled').notNullable().defaultTo(true);
    t.integer('review_delay_minutes').notNullable().defaultTo(45);
    t.boolean('guardian_extend_enabled').notNullable().defaultTo(true);
    t.integer('guardian_extend_minutes').notNullable().defaultTo(60);
  });

  await knex.schema.alterTable('sessions', (t) => {
    t.string('guest_token', 48).nullable().unique();
    t.integer('guardian_added_minutes').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('bookings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.enu('type', ['party', 'workshop']).notNullable();
    t.string('reference', 12).notNullable();
    t.string('public_token', 48).notNullable().unique();

    // The booker. May or may not already be a registered customer.
    t.uuid('customer_id').nullable().references('id').inTable('customers').onDelete('SET NULL');
    t.string('guardian_name').notNullable();
    t.string('phone').notNullable();

    t.timestamp('starts_at', { useTz: true }).notNullable();
    t.timestamp('ends_at', { useTz: true }).notNullable();
    t.integer('children_count').notNullable();
    t.string('theme', 40).nullable();
    t.string('food', 40).nullable();
    t.text('notes').nullable();

    t.decimal('amount', 12, 2).notNullable().defaultTo(0);
    t.decimal('paid_amount', 12, 2).notNullable().defaultTo(0);
    // `pending` = slot is HELD but unconfirmed; it still blocks the calendar.
    t.enu('status', ['pending', 'confirmed', 'cancelled', 'completed']).notNullable().defaultTo('pending');
    t.enu('payment_status', ['unpaid', 'partial', 'paid', 'refunded']).notNullable().defaultTo('unpaid');
    t.string('payment_ref', 120).nullable();

    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'reference']);
    t.index(['tenant_id', 'starts_at']);
    t.index(['tenant_id', 'status']);
  });

  // THE anti-double-booking guarantee. Two concurrent requests for the same slot
  // cannot both commit: the loser gets a 23P01 exclusion_violation, which the
  // service maps to a friendly 409. Cancelled bookings free their slot again.
  await knex.raw(`
    alter table bookings add constraint bookings_no_overlap
    exclude using gist (
      tenant_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status <> 'cancelled')
  `);

  await knex.schema.createTable('reviews', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('session_id').nullable().references('id').inTable('sessions').onDelete('CASCADE');
    t.uuid('booking_id').nullable().references('id').inTable('bookings').onDelete('CASCADE');
    t.uuid('customer_id').nullable().references('id').inTable('customers').onDelete('SET NULL');
    t.string('token', 48).notNullable().unique();
    t.integer('rating').nullable(); // 1..5, null until she answers
    t.text('comment').nullable();
    t.timestamp('sent_at', { useTz: true }).nullable();
    t.timestamp('submitted_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['session_id']);
    t.index(['tenant_id', 'submitted_at']);
  });
  await knex.raw('alter table reviews add constraint reviews_rating_range check (rating is null or (rating between 1 and 5))');

  // The notification type enum gains the two new outbound messages. Knex's
  // `enu` is a varchar + CHECK, so widening it means swapping the constraint.
  await knex.raw('alter table notifications drop constraint if exists notifications_type_check');
  await knex.raw(`
    alter table notifications add constraint notifications_type_check
    check (type in ('warn_5','time_up','late','review','booking_confirmed'))
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw('alter table notifications drop constraint if exists notifications_type_check');
  await knex.raw(`
    alter table notifications add constraint notifications_type_check
    check (type in ('warn_5','time_up','late'))
  `);
  await knex.schema.dropTableIfExists('reviews');
  await knex.schema.dropTableIfExists('bookings');
  await knex.schema.alterTable('sessions', (t) => {
    t.dropColumn('guest_token');
    t.dropColumn('guardian_added_minutes');
  });
  await knex.schema.alterTable('settings', (t) => {
    t.dropColumn('terms_url');
    t.dropColumn('booking_config');
    t.dropColumn('reviews_enabled');
    t.dropColumn('review_delay_minutes');
    t.dropColumn('guardian_extend_enabled');
    t.dropColumn('guardian_extend_minutes');
  });
  await knex.schema.alterTable('children', (t) => {
    t.dropColumn('has_allergy');
    t.dropColumn('allergy_note');
  });
};
