/**
 * Print the links you need to click through the app locally.
 *
 * Some links are deliberately unguessable and are never shown in the staff UI
 * (a mother reaches them from WhatsApp), so this reads them from the database:
 *
 *   node scripts/dev-links.mjs
 *
 * Override with APP_BASE (default http://localhost:8899) and PSQL_CMD.
 * Development convenience only — it prints tokens, so don't run it against a
 * production database on a shared screen.
 */
import { execSync } from 'node:child_process';

const APP = (process.env.APP_BASE || 'http://localhost:8899').replace(/\/$/, '');
const PSQL = process.env.PSQL_CMD || 'docker exec farfasha-postgres psql -U farfasha -d farfasha';

// The query must reach psql as ONE line — a newline inside the quoted argument
// is swallowed by the shell and psql then sees a truncated statement.
const q = (sql) => execSync(`${PSQL} -tAc "${sql.replace(/\s+/g, ' ').trim().replace(/"/g, '\\"')}"`)
  .toString().trim().split('\n').filter(Boolean).map((l) => l.split('|'));

const section = (title) => console.log(`\n${title}\n${'─'.repeat(title.length)}`);

section('Public pages (no login)');
console.log(`  Registration form   ${APP}/register`);
console.log(`  Book a party        ${APP}/book`);

section('"Add an hour" links — one per child currently playing');
const live = q(`select ch.name, s.guest_token,
                  greatest(0, round(extract(epoch from (s.ends_at - now()))/60))
                from sessions s join children ch on ch.id = s.child_id
                where s.status <> 'completed' and s.guest_token is not null
                order by s.ends_at`);
if (!live.length) console.log('  (nothing playing — start a session first)');
for (const [name, token, mins] of live) {
  console.log(`  ${name.padEnd(12)} ${mins}m left   ${APP}/x/${token}`);
}

section('Review links — created when you check a child out');
const reviews = q(`select coalesce(ch.name, '?'), r.token,
                     case when r.submitted_at is null then 'unanswered' else 'answered' end
                   from reviews r
                   left join sessions s on s.id = r.session_id
                   left join children ch on ch.id = s.child_id
                   order by r.created_at desc limit 5`);
if (!reviews.length) console.log('  (none yet — end a session from the dashboard)');
for (const [name, token, state] of reviews) {
  console.log(`  ${name.padEnd(12)} ${state.padEnd(11)} ${APP}/r/${token}`);
}

section('Customer QR cards');
for (const [name, code, token] of q('select full_name, customer_code, qr_token from customers limit 5')) {
  console.log(`  ${name.padEnd(18)} ${code}   ${APP}/c/${token}`);
}

section('Sign in');
console.log(`  Manager       manager@farfasha.sa / manager123   (everything)`);
console.log(`  Receptionist  staff@farfasha.sa   / staff123     (play + read-only)`);
console.log(`\n  ${APP}/login\n`);
