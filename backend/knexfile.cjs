/**
 * Knex config for the migration/seed CLI (CommonJS on purpose so the CLI works
 * regardless of the package being ESM). The running app builds its own knex
 * instance in src/config/db.js from the same env.
 *
 * Migration & seed files are authored as `.cjs` so the CLI's CommonJS loader
 * reads them cleanly inside this ESM package.
 */
const path = require('path');

// Load the project-root .env (one level up from /backend), falling back to a
// local backend/.env. Existing process.env (e.g. docker-compose) always wins.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const connection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'farfasha',
      password: process.env.PGPASSWORD || 'farfasha',
      database: process.env.PGDATABASE || 'farfasha',
    };

/** @type {import('knex').Knex.Config} */
const config = {
  client: 'pg',
  connection,
  pool: { min: 0, max: 10 },
  migrations: {
    directory: path.resolve(__dirname, 'src/db/migrations'),
    loadExtensions: ['.cjs'],
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.resolve(__dirname, 'src/db/seeds'),
    loadExtensions: ['.cjs'],
  },
};

module.exports = config;
module.exports.development = config;
module.exports.production = config;
