/** Shared Knex instance for the running app (query builder over PostgreSQL). */
import knexFactory from 'knex';
import { env } from './env.js';

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
