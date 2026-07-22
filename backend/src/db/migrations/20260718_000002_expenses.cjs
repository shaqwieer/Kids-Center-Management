/** Persisted, tenant-scoped operating expenses used by the finance ledger. */
/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('expenses', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('title', 160).notNullable();
    t.string('category', 40).notNullable();
    t.decimal('amount', 12, 2).notNullable();
    t.timestamp('incurred_at', { useTz: true }).notNullable();
    t.text('notes').nullable();
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['tenant_id', 'incurred_at']);
    t.index(['tenant_id', 'category']);
  });
  await knex.raw('alter table expenses add constraint expenses_amount_positive check (amount > 0)');
};
/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) { await knex.schema.dropTableIfExists('expenses'); };
