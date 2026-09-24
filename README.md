# 🎈 Farfasha Play Center — Management System / نظام إدارة مركز فرفشة

A bilingual (Arabic-default RTL / English) management system for a kids play center: public QR self-registration, a live **server-authoritative** play-session timer, WhatsApp time-up notifications, customer profiles with reprintable QR cards, settings, and a finance overview.

> **Usage guides (how staff actually use it), in both languages:**
> - 🇸🇦 [`docs/USAGE.ar.md`](docs/USAGE.ar.md) — دليل الاستخدام بالعربية
> - 🇬🇧 [`docs/USAGE.en.md`](docs/USAGE.en.md) — English usage guide

---

## ✨ Features

- **Public QR registration** — a poster QR opens a no-login page where a mother registers herself + her children and gets a personal QR card + short customer code. Per child: name, **date of birth** (age is derived), gender, and an **allergy** yes/no with a free-text note. The consent statement links to the centre's **terms page** (`/terms`), whose text the manager writes in Settings.
- **Allergy visibility** — a child with a recorded allergy carries a red warning band (icon + text, never colour alone) on their live session card, so staff see it at the moment play starts.
- **Party & workshop booking link** (`/book`) — a public calendar page: occasion type, month grid, time slot, children count, theme, catering, live price. **Double-booking is impossible**: a Postgres `EXCLUDE USING gist` constraint on the time range means two simultaneous confirms produce exactly one booking and one clean 409. Bookings are reserve-now / **pay at the centre** (no live gateway is integrated).
- **Guardian self-extension** — the 5-minutes-left WhatsApp message carries a one-tap link (`/x/<token>`) where the mother sees a live countdown and adds an hour herself. It goes through the same server-authoritative `addTime` path, so jobs reschedule and the staff dashboard updates in real time.
- **Post-visit review** — checkout mints a review link and schedules a WhatsApp ask (delay configurable); `/r/<token>` collects a 1–5 rating plus "how can we serve you better?". Single-use, with a manager-side rollup (average, distribution, response rate, comments).
- **Insights dashboard** (`/insights`) — busiest day, busiest hour, traffic by weekday/hour, income by source, duration mix, child demographics, and a 6-month revenue trend. All bucketed in **Asia/Riyadh**, so a 9pm visit never lands on the previous day.
- **Excel reports** — real multi-sheet `.xlsx` export (summary, visits, customers, children, bookings, expenses, reviews) for any period, written right-to-left in Arabic.
- **Returning-customer flow** — staff scan the QR **or** look up by phone; the mother + her children load instantly (nothing re-entered). An "update data" path is included.
- **Server-authoritative sessions** — start a session (30/60/120 min), the **server** sets `started_at` / `ends_at`. The frontend countdown is derived purely from `ends_at`; the client clock is never trusted for notifications.
- **Reliable scheduled notifications** — on start, two delayed **BullMQ** jobs are enqueued: a *5-minutes-left* warning and a *time-up* alert. **Add Time** re-schedules them and can **never leave an orphaned job** (see *Timing correctness* below).
- **Live dashboard** — a real-time grid of currently-playing children with progress rings and playing / ending-soon / overtime states, kept in sync across multiple staff devices via **Socket.IO**.
- **WhatsApp, provider-agnostic** — a swappable adapter (Meta Cloud API default; Twilio / Unifonic stubs). Fully **env-toggleable**: runs end-to-end in a dev/sandbox mode that *logs* messages so the system works before the WhatsApp Business account is ready.
- **Finance overview** with revenue split across the three income sources (play time / parties / workshops), **settings** (durations & prices, late-fee rate, party & workshop pricing and slots, centre terms (page text or external link), review + self-extension toggles, WhatsApp templates, branding), and a **future-ready payments** placeholder (Moyasar / HyperPay / Geidea).

## 🧱 Stack

| Layer | Tech |
|------|------|
| Frontend | Vue 3 (Composition API) + Vite, Pinia, Vue Router, vue-i18n (ar/en, RTL/LTR), Socket.IO client, axios, qrcode |
| Backend | Node.js + Express (REST), Socket.IO, **BullMQ** + Redis (scheduled notifications) |
| Database | PostgreSQL + **Knex** migrations & seeds |
| Auth | JWT staff login, roles `admin` / `staff` |
| Infra | docker-compose (Postgres + Redis + backend + frontend) |

Timezone: **Asia/Riyadh**. Multi-tenant-**ready** schema (a `tenants` table + `tenant_id` FKs, one seeded tenant `farfasha`) — no multi-tenant UI.

---

## 🚀 Quick start — Docker (recommended)

Prerequisites: Docker + Docker Compose.

```bash
cp .env.example .env          # then edit secrets (JWT_SECRET, etc.)
docker compose up -d --build  # starts postgres, redis, backend, frontend
docker compose exec backend npm run seed   # seed sample staff + Arabic customers
```

- App: **http://localhost:5173**
- API health: **http://localhost:4000/api/health**

The backend runs migrations automatically on boot. Seeding is a one-time manual step.

> **Port already in use?** If `5432` / `6379` / `4000` / `5173` are taken on your machine, change `PGPORT` / `REDIS_PORT` / `API_PORT` / `FRONTEND_PORT` in `.env` and re-run `docker compose up -d`.

### Demo logins (created by the seed)

| Role | Email | Password |
|------|-------|----------|
| Manager | `manager@farfasha.sa` | `manager123` |
| Staff | `staff@farfasha.sa` | `staff123` |

There are two roles.

| | Manager (مدير) | Receptionist (موظف استقبال) |
|---|---|---|
| Start / extend / end play | ✅ | ✅ |
| View customers, children, bookings | ✅ | ✅ (read-only) |
| Finance, expenses, insights, Excel export | ✅ | ❌ 403 |
| Create/edit customers & bookings | ✅ | ❌ 403 |
| Settings, Team | ✅ | ❌ 403 |

Receptionists run the floor — start play, add time, check out, and look things up —
but the money side and every write to customer/booking records are manager-only.
This is enforced server-side by `requireRole('manager')`; the router guard and the
hidden nav items are convenience, not the boundary. Accounts are created by a
manager from **Team** — there is no public sign-up.

> Change these in `.env` (`SEED_*`) before seeding, and rotate `JWT_SECRET`, for anything but local testing.

---

## 🛠️ Quick start — local development (without Docker)

You still need Postgres + Redis running somewhere (e.g. `docker compose up -d postgres redis`).

```bash
cp .env.example .env          # point DATABASE_URL / REDIS_URL at your instances

# Backend
cd backend
npm install
npm run migrate
npm run seed
npm run dev                   # API + Socket.IO + inline worker on :4000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                   # Vite dev server on :5173
```

For local dev, set in `.env`:
```
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

### Scaling the worker separately (optional)

By default the API process runs the BullMQ worker inline (`WORKER_INLINE=true`). To run it as its own process:
```bash
# in the API process, set WORKER_INLINE=false, then:
cd backend && npm run worker
```
The worker updates dashboards even when separate — it publishes events over Redis and the API re-emits them to Socket.IO clients.

---

## ⏱️ Timing correctness (the #1 priority)

- The **server** computes all timestamps. Session `ends_at = started_at + duration`. The frontend only *displays* a countdown derived from `ends_at`.
- **BullMQ owns all scheduling.** Two delayed jobs per session: `warn_5` at `ends_at − 5 min`, `time_up` at `ends_at`.
- Each session has a `schedule_version`. Every start / add-time / end **bumps** it, and job IDs embed the version (`warn5:<id>:v3`). When a job fires, the worker re-reads the session and **ignores** it unless `job.version === session.schedule_version` (and the session isn't completed). So a stale job left over from a prior **Add Time** is *harmless* — correctness never depends on perfectly removing the old job (we still remove it best-effort to keep Redis tidy).
- **Add Time** extends `ends_at`, bumps the version, and reschedules; if the extension pushes the end back into the future, the status returns to `active`/`warned`.
- Failed WhatsApp sends are retried by BullMQ (3 attempts, exponential backoff) and every attempt is logged to the `notifications` table.

This behaviour is covered by tests (below).

## ✅ Tests & proofs

```bash
cd backend
npm test                       # pure timing-math unit tests (no DB/Redis needed)

# End-to-end proofs (need postgres+redis up + migrate+seed):
node scripts/lifecycle-proof.mjs   # start → add-time → end, job scheduling, version guard
node scripts/notify-proof.mjs      # worker send path + notification logging (log adapter)
node scripts/worker-fire-proof.mjs # the live worker autonomously fires a delayed job
API_PORT=4077 node scripts/http-smoke.mjs   # full REST/auth flow over HTTP
API_BASE=http://localhost:4077 node scripts/users-proof.mjs  # staff accounts + role guards

# Bookings / reviews / self-extend / allergies / roles / Excel (55 assertions):
API_BASE=http://localhost:4077/api node scripts/growth-proof.mjs
```

> `growth-proof` fires **two genuinely concurrent** bookings at one slot and asserts
> exactly one 201 and one 409, checks the manager/receptionist boundary from both
> sides, round-trips a birthdate to catch timezone day-shift, drives the guardian
> self-extend and review links end to end, and downloads all six `.xlsx` reports.
> It reads two opaque tokens straight from Postgres (`PSQL_CMD` to override how).

> `http-smoke` registers a fixed demo phone and asserts it is newly created, so it
> expects a **freshly seeded** database — run `npm run seed` before it. On a second
> run against the same data that customer already exists and the register assertion
> fails (`200 !== 201`). The other proofs are re-runnable.

UI proofs drive a real headless Chrome against the running stack (they assume the
app on `:8899` and the API on `:4077` — override with `APP_BASE` / `API_BASE`, and
point at another browser with `CHROME_PATH`):

```bash
cd frontend
node scripts/team-ui-proof.mjs      # create an account through the Team page, then sign in as it
node scripts/staff-gate-proof.mjs   # staff sees no Team nav, is bounced off /team, can't save settings
node scripts/nav-guard-proof.mjs    # the full router guard matrix (see below)
node scripts/qr-scan-proof.mjs      # the camera scanner really reads a customer's card (see below)
node scripts/poster-proof.mjs       # the registration QR encodes /register and prints alone on A4
node scripts/register-layout-proof.mjs  # the public form is full-bleed + full-width, and the
                                        # cards paint ABOVE the welcome band instead of under it
node scripts/login-error-proof.mjs  # a failed sign-in speaks the reader's language
node scripts/responsive-proof.mjs   # no page scrolls sideways at any width (see below)
```

`responsive-proof` walks every route across 13 widths from **360px** to 1920px,
including the exact pixels either side of each header breakpoint. It detects
overflow off **both** edges — in RTL a too-wide header runs off the *left*, which
a `.right`-only check reports as a phantom "overflow via null".

> Deliberately, there is **no `overflow-x: hidden` on `html`/`body`**. It would clamp
> `documentElement.scrollWidth` and make this proof pass while the page is still
> broken. Layouts are fixed at the source instead.

> `qr-scan-proof` needs no webcam: it paints a real customer's card QR into a Y4M
> clip and hands it to Chrome as a fake camera (`--use-file-for-fake-video-capture`),
> so the scanner decodes a genuine QR and must land on that exact customer.

### Navigation guards

`frontend/src/router/index.js` enforces, and `nav-guard-proof.mjs` proves:

| Situation | Result |
|---|---|
| Signed out, opens a protected page | → `/login?redirect=<target>`, and signing in returns them to `<target>` |
| Session expired (token past its `exp`) | Treated as signed out; the dead token is purged rather than flashing a protected page |
| Signed in, opens `/login` | **Signed out**, and left on the sign-in form — reception shares one screen |
| Staff opens `/team` | → dashboard (the API also returns 403, so the UI gate is not the only guard) |
| Signed out, opens `/register` or `/c/:token` | Stays open — these are public |
| Unknown route | Catch-all → `/` → the rules above apply |

The client-side checks are for flow, not security: every protected endpoint is
enforced server-side by `requireAuth` / `requireRole`.

---

## 🔔 WhatsApp configuration

Set in `.env`:

- **Dev / before the account is ready:** `WHATSAPP_ENABLED=false` → every message is logged to the console (and recorded in `notifications`), nothing is sent. The whole system works end-to-end.
- **WhatsLoop (what this centre uses):** `WHATSAPP_ENABLED=true`, `WHATSAPP_PROVIDER=whatsloop`, `WHATSLOOP_TOKEN=<your key>`, `WHATSLOOP_BASE_URL=https://blend-play-sip.whatsloop.net/api/v1` (your own subdomain — *not* the generic `whatsloop.net`). `WHATSLOOP_CHANNEL_ID` is only needed if the account has more than one connected WhatsApp channel. Messages go out as plain text via `POST /messages/send-text`, so the Settings templates are sent exactly as written — **no pre-approved Meta-style templates to register.**
- **Meta WhatsApp Cloud API:** `WHATSAPP_ENABLED=true`, `WHATSAPP_PROVIDER=meta`, set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and your approved template names (`WHATSAPP_TEMPLATE_WARN5`, `WHATSAPP_TEMPLATE_TIMEUP`, `WHATSAPP_TEMPLATE_WELCOME`).
- **Swap in a Saudi BSP / other provider:** set `WHATSAPP_PROVIDER=unifonic` (or `twilio`) and its credentials. Adding a new provider = one adapter file in `backend/src/whatsapp/providers/` — no domain changes.

> ⚠️ **Both switches matter.** `WHATSAPP_PROVIDER=whatsloop` on its own sends nothing —
> while `WHATSAPP_ENABLED=false` the system forces the `log` adapter no matter what the
> provider says. This is the single most common "why aren't messages sending?" cause.

Verify the integration:

```bash
cd backend
node scripts/whatsloop-proof.mjs        # 18 assertions, stubbed fetch — sends nothing
node scripts/whatsloop-send.mjs 05XXXXXXXX   # sends ONE real message to your own number
```

WhatsLoop rate limits sends to 30/min. The adapter waits out a short `Retry-After`
once, and otherwise throws so BullMQ's retry (3 attempts, exponential from 5s) owns it;
failures land in `notifications.error` with the HTTP status attached.

Message templates (per type, per language) are editable in **Settings**. Variables: `{name}`/`{الاسم}`, `{child}`/`{الطفل}`, `{minutes}`/`{الدقائق}`, `{code}`/`{الرمز}`, `{center}`/`{المركز}`, and `{link}`/`{الرابط}`.

`{link}` is context-sensitive: in the **warn_5** template it is the mother's one-tap
"add an hour" page, and in the **review** template it is her rating page. Leave it
out of warn_5 to turn the self-extension prompt off for that message (the feature
itself has its own toggle in Settings).

---

## 🗂️ Project structure

```
.
├─ backend/
│  ├─ src/
│  │  ├─ config/        env, db (knex), redis
│  │  ├─ lib/timing.js  pure, tested session-timing math
│  │  ├─ db/            migrations/ + seeds/ (.cjs)
│  │  ├─ modules/       auth, customers, sessions, settings, finance, expenses,
│  │  │                 bookings, reviews, analytics, reports, notifications,
│  │  │                 tenants, users, public
│  │  ├─ queue/         BullMQ connection, scheduler, worker (version guard)
│  │  ├─ realtime/      Socket.IO server + Redis emit bridge
│  │  ├─ whatsapp/      provider-agnostic adapter (log/whatsloop/meta/twilio/unifonic)
│  │  ├─ payments/      future-ready PaymentProvider placeholder
│  │  ├─ app.js, routes.js, index.js
│  │  └─ scripts/       lifecycle-proof, notify-proof, worker-fire-proof, http-smoke, users-proof
│  ├─ knexfile.cjs, Dockerfile
├─ frontend/
│  ├─ src/
│  │  ├─ i18n/          ar.js + en.js (RTL/LTR)
│  │  ├─ lib/           api, socket, time, colors
│  │  ├─ stores/        auth, ui, sessions, customers, settings, finance, users,
│  │  │                 bookings, insights
│  │  ├─ components/    AppHeader (+ mobile drawer), BrandLogo, ProgressRing, SessionCard, QrScanner, ToastHost
│  │  ├─ views/         Login, Dashboard, StartSession, Checkout, Customers, Settings,
│  │  │                 Finance, Insights, Bookings, Team, Register, Card,
│  │  │                 PublicBooking (/book), Review (/r/:token), Extend (/x/:token)
│  │  ├─ router/, assets/styles.css, App.vue, main.js
│  ├─ nginx.conf, Dockerfile
├─ docs/USAGE.ar.md, docs/USAGE.en.md
├─ docker-compose.yml
└─ .env.example
```

## 🔌 API summary

All under `/api`. JWT Bearer required except `/api/auth/login` and `/api/public/*`.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/login` | staff login → `{ token, user }` |
| GET | `/auth/me` | current user |
| GET | `/customers?search=` | search customers |
| GET | `/customers/:id` | customer + children + visit history |
| POST/PUT | `/customers[/:id]` | create / update (guardian + children) |
| GET | `/customers/lookup?qr=&phone=` | resolve for Start Session |
| POST | `/public/register` | **public** QR registration → code + qr_token |
| GET | `/public/customers/:qr_token` | **public** card lookup |
| GET | `/sessions?status=active` | live sessions |
| POST | `/sessions` | start (one per child) |
| GET | `/sessions/:id` | session detail (checkout) |
| POST | `/sessions/:id/add-time` | extend + reschedule |
| POST | `/sessions/:id/end` | complete + compute late fee |
| GET/PUT | `/settings` | read / update (PUT = manager) |
| GET | `/finance/summary?period=` | today/week/month totals **(manager)** |
| GET | `/notifications?session_id=` | notification log |
| GET | `/bookings`, `/bookings/availability` | parties & workshops |
| POST/PUT | `/bookings[/:id]` | create / confirm / cancel **(manager)** |
| GET | `/analytics/insights?period=` | busiest day/hour, income sources, trends **(manager)** |
| GET | `/reviews/summary?period=` | rating rollup |
| GET | `/reports/export?type=&period=` | **.xlsx** download **(manager)** |
| GET | `/public/center` | branding + terms link |
| GET | `/public/terms` | the centre terms page text (ar/en) |
| GET/POST | `/public/booking…` | config, availability, quote, create, lookup |
| GET/POST | `/public/review/:token` | read / submit a visit review |
| GET/POST | `/public/session/:token[/extend]` | guardian countdown + self-extend |

Public write endpoints (`/public/register`, `/public/booking`, `/public/review/*`,
`/public/session/*/extend`) are rate-limited per IP.

**Socket.IO** (auth via JWT in the handshake): `session:created`, `session:updated`, `session:ended`, `notification:sent`, and a periodic `tick`.

## 🎉 Bookings & the double-booking guarantee

Parties and workshops share one `bookings` table. Availability listing is a
courtesy; the actual guarantee is in Postgres:

```sql
exclude using gist (
  tenant_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status <> 'cancelled')
```

Two mothers confirming the same slot in the same millisecond cannot both commit —
the loser gets `23P01`, which the service maps to a friendly **409**. `pending`
bookings still hold their slot; cancelling releases it. Prices are recomputed
server-side on create, so a tampered client cannot set its own total.

`backend/scripts/` and the smoke suite assert this with two genuinely concurrent
requests, not two sequential ones.

## 🧩 Future-ready

- **Payments**: `backend/src/payments/PaymentProvider.js` defines a `PaymentProvider` interface with Moyasar / HyperPay / Geidea stubs and a `payments_enabled` settings hook, so late-pickup auto-charge and pay-online party bookings can be added without touching the domain. No live gateway is integrated — bookings are reserve-now / pay-at-centre.
- **Multi-tenant**: schema is tenant-scoped; add a tenant switcher + tenant-aware login to go multi-center.
- **Finance and expenses**: tenant-scoped expense CRUD, category breakdown, combined transaction ledger, and net profit calculated with real completed-session revenue.

## 📄 License

Proprietary — built for the Farfasha Play Center client.
