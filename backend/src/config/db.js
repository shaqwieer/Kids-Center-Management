/** Shared Knex instance for the running app (query builder over PostgreSQL). */
import knexFactory from 'knex';
import pg from 'pg';
import { env } from './env.js';

// A DATE has no time and no timezone — a birthday is the same day everywhere.
// node-postgres otherwise turns `2020-05-14` into a JS Date at LOCAL midnight,
// which serialises back as `2020-05-13T21:00:00Z` in Riyadh (UTC+3) and hands
// the browser a date one day earlier than the mother typed. Keep DATE as text.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

const connection = env.db.url
  ? { connectionString: env.db.url }
  : {
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
    };

export const db = knexFactory({
  client: 'pg',
  connection,
  pool: { min: 0, max: 10 },
});

export async function pingDb() {
  await db.raw('select 1');
}

export default db;
