/**
 * Initial schema for Farfasha Play Center.
 * Tenant-ready: a `tenants` table + tenant_id FKs on core tables. A single
 * tenant is seeded; there is no multi-tenant UI. Uniqueness that must be
 * per-center (phone, customer_code, email) is scoped by tenant_id.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.raw('create extension if not exists pgcrypto');

  await knex.schema.createTable('tenants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('slug').notNullable().unique();
    t.string('name').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('email').notNullable();
    t.string('password_hash').notNullable();
    t.enu('role', ['manager', 'staff']).notNullable().defaultTo('staff');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'email']);
  });

  await knex.schema.createTable('customers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('full_name').notNullable();
    t.string('phone').notNullable();
    t.string('national_id').nullable();
    t.string('customer_code').notNullable();
    t.string('qr_token').notNullable().unique();
    t.boolean('consent').notNullable().defaultTo(false);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'phone']);
    t.unique(['tenant_id', 'customer_code']);
    t.index(['tenant_id']);
  });

  await knex.schema.createTable('children', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('customer_id').notNullable().references('id').inTable('customers').onDelete('CASCADE');
    t.string('name').notNullable();
    t.date('birthdate').nullable();
    t.integer('age').nullable();
    t.enu('gender', ['m', 'f']).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['customer_id']);
  });

  await knex.schema.createTable('sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('child_id').notNullable().references('id').inTable('children').onDelete('CASCADE');
    t.uuid('customer_id').notNullable().references('id').inTable('customers').onDelete('CASCADE');
    t.integer('duration_minutes').notNullable();
    t.timestamp('started_at', { useTz: true }).notNullable();
    t.timestamp('ends_at', { useTz: true }).notNullable();
    t.enu('status', ['active', 'warned', 'completed', 'overtime']).notNullable().defaultTo('active');
    t.uuid('started_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('ended_at', { useTz: true }).nullable();
    t.integer('late_minutes').notNullable().defaultTo(0);
    t.decimal('late_fee', 10, 2).notNullable().defaultTo(0);
    // Incremented on every start/add-time/end. The worker ignores any fired job
    // whose version does not match — this makes orphaned/stale jobs harmless.
    t.integer('schedule_version').notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['tenant_id', 'status']);
    t.index(['customer_id']);
    t.index(['child_id']);
    t.index(['ended_at']);
  });

  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('session_id').notNullable().references('id').inTable('sessions').onDelete('CASCADE');
    t.enu('type', ['warn_5', 'time_up', 'late']).notNullable();
    t.string('channel').notNullable().defaultTo('whatsapp');
    t.enu('status', ['queued', 'sent', 'failed']).notNullable().defaultTo('queued');
    t.string('provider_message_id').nullable();
    t.timestamp('sent_at', { useTz: true }).nullable();
    t.text('error').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    // One logical notification per (session, type); retries update the same row.
    t.unique(['session_id', 'type']);
    t.index(['session_id']);
  });

  await knex.schema.createTable('settings', (t) => {
    t.uuid('tenant_id').primary().references('id').inTable('tenants').onDelete('CASCADE');
    // [{ min, price }] — allowed durations & their prices.
    t.jsonb('durations').notNullable().defaultTo(JSON.stringify([
      { min: 30, price: 25 },
      { min: 60, price: 40 },
      { min: 120, price: 70 },
    ]));
    t.decimal('late_fee_per_minute', 10, 2).notNullable().defaultTo(0);
    t.string('center_name').notNullable().defaultTo('Blend Play & Sip');
    t.string('tagline').notNullable().defaultTo('حيث تبدأ المتعة');
    t.string('primary_color').notNullable().defaultTo('#F97A53');
    t.string('currency').notNullable().defaultTo('SAR');
    // { welcome:{ar,en}, warn_5:{ar,en}, time_up:{ar,en} }
    t.jsonb('wa_templates').notNullable().defaultTo(JSON.stringify({
      welcome: { ar: '', en: '' },
      warn_5: { ar: '', en: '' },
      time_up: { ar: '', en: '' },
    }));
    t.boolean('payments_enabled').notNullable().defaultTo(false);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('children');
  await knex.schema.dropTableIfExists('customers');
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('tenants');
};
