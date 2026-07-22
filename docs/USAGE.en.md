# Farfasha Play Center — Staff Usage Guide 🎈

This guide walks staff through the system step by step: registering a customer, printing/scanning the QR, starting a session, adding time, ending a session, and how WhatsApp notifications work.

> The system is bilingual. The **English / عربي** button at the top of the screen switches the language and layout direction (RTL/LTR) at any time.

---

## 1) Staff sign in

1. Open the app URL (e.g. `http://localhost:5173`).
2. Enter your email and password, then press **Sign in**.
   - Manager (can edit Settings, Finance, and the Team): `manager@farfasha.sa`
   - Reception staff: `staff@farfasha.sa`
3. After signing in you land on the **"Who's Playing Now"** dashboard.

### Handing the screen to a colleague

Opening the sign-in page **signs out whoever is currently using it**. Reception
shares one screen, so going to `/login` — or pressing **Log out** — always ends
the current session and leaves a clean sign-in form for the next person. You
cannot be signed in as one person and looking at the sign-in page as another.

The reverse also holds: if you are not signed in (or your session has expired
after 12 hours), any page you try to open sends you to sign in first, then takes
you to the page you originally wanted.

### Adding a colleague's account

Only a manager can do this.

1. Open **Team** in the top navigation.
2. Press **Add account**.
3. Fill in the name, email, and a password of at least 6 characters.
4. Choose the role — **Manager** or **Receptionist**.
5. Press **Create account**. Your colleague can now sign in with that email and password.

**What's the difference?**

| | Manager | Receptionist |
|---|---|---|
| Start / extend / end play | ✅ | ✅ |
| View customers, children, bookings | ✅ | ✅ (read-only) |
| Finance, expenses, insights, Excel export | ✅ | ❌ |
| Add or edit customers & bookings | ✅ | ❌ |
| Settings, Team | ✅ | ❌ |

A receptionist runs the floor — starts play, adds time, checks out, looks people up —
while the money side and any edit to records stays with the manager. This is enforced
by the server itself, not just hidden in the interface.

To change a name, email, password, or role later, press the pencil on their card.
The trash icon removes the account; the person can no longer sign in, but the
sessions they recorded stay in the history. The system will not let you delete the
account you are signed in with, or remove the last manager.

---

## 1b) Put the registration poster at the entrance

**Team → Settings → Registration poster** shows a QR code that opens the
registration form. Press **Print poster** for a ready A4 sheet — brand, code, and
three short steps for the parent. Put it at the entrance; a parent scans it with
her own phone camera and registers herself.

> The QR points at whatever address you are using in the browser. If it shows
> `localhost`, the poster warns you — that address only works on this computer and
> will not open on a parent's phone. Print it from a device using the center's real
> network address (or its domain) so the code resolves for everyone.

## 2) Register a new customer (via QR poster or reception)

There are two ways to register a mother and her children:

### a) Self-registration via the QR poster (no staff needed)
- A poster at the entrance shows a QR code. Scanning it with a phone opens the **registration page** directly (no login).
- The mother enters: **full name**, **mobile number**, (national ID is optional), then adds **one or more children**, and agrees to the terms.
- For each child she gives: **name**, **date of birth** (the age fills in automatically), **boy/girl**, and **whether the child has any allergy** — answering *Yes* opens a box to describe it.
- The consent line carries a link to your **centre terms**, so she can read them before agreeing. Set that link under Settings.

> **Allergies are shown where they matter.** A child with a recorded allergy carries a red warning band on their card on the live dashboard the whole time they are playing — staff do not have to go looking for it.
- On **Create account**, the system generates a short **customer code** (e.g. `FRF-2048`) and a **personal QR card** shown on screen.
- She taps **Save card** to print it or keep it on her phone for future visits.

### b) Registration at reception
- From the header (or the menu on a phone), press **Register** to open the same page and enter the details on the customer's behalf.

> **Phone already registered?** If the mobile number already exists, the system shows the existing customer's card instead of creating a duplicate.

---

## 3) Print / scan the QR card

- **Printing:** open the customer's profile (**Customers** screen) — the **Personal card** shows the QR and customer code; press **Print card**.
- **Scanning on the next visit:** start a session, press **Open camera**, and hold the
  mother's card up to it. The moment it reads the code, she and her children appear —
  **with nothing re-entered**. Searching by phone or name still works as a fallback.

> **The camera needs a secure connection.** Browsers only allow it on `https://`
> or on `localhost`. If reception opens the app over the network by plain IP
> (e.g. `http://192.168.1.5:8899`), the camera is blocked and the app says so —
> put the app behind HTTPS to scan from a tablet. Searching by phone always works.

---

## 4) Start a play session

From the dashboard press **Start New Session**, then follow the three steps:

1. **Customer:** scan the QR card, or search by name/phone and select the customer. Her registered children appear.
2. **Child & duration:** select **one or more children**, then choose a **play duration** (30 min / 1 hour / 2 hours). Each option shows its price.
3. **Confirm:** review the summary (mother, children, duration, total) and press **Start Play**.

> The timer starts the moment you press "Start Play". The **server** computes the end time, so the countdown stays accurate across every device.

The dashboard shows a card per playing child with a **progress ring**, time left, and state:
- 🟢 **Playing** — plenty of time.
- 🟠 **Ending soon** — 5 minutes or less remaining.
- 🔴 **Overtime** — the booked time is up.

---

## 5) Add time

- On a child's card, press **＋ Add Time** to extend the session.
- The system updates the end time automatically **and reschedules the notifications** to the new time — never leaving a stale notification pending.

---

## 6) End a session (checkout)

1. On the child's card, press **End Session**.
2. The **Complete Session** screen shows: chosen duration, actual time played, check-in/out window, and the session fee.
   - If the mother went over time and the **overtime rate** is enabled, a late fee is calculated and displayed (calculation only — there is no online payment yet).
3. Press **Complete & end session**. The visit is saved to the customer's **visit history**.

---

## 7) How do WhatsApp notifications work?

When a session starts, the system schedules two automatic messages to the guardian:
- **5 minutes before the end:** a "5 minutes left…" message.
- **At time up:** a "play time is up…" message.

- Messages are sent automatically over WhatsApp, and every send attempt (success or failure) is logged, with automatic retry on failure.
- **Before the WhatsApp Business account is ready:** the system runs in a sandbox mode that *logs* messages instead of sending them — so everything can be run and tested first. The admin enables real sending later in the server settings.
- **Message texts** (Arabic and English) are editable on the **Settings** screen, using the variables: `{name}`, `{child}`, `{minutes}`, `{code}`, `{center}`, `{link}`.

### The mother can add an hour herself

The *5 minutes left* message includes a link. When she taps it she sees her child's
name, a live countdown, and the price of an extension — one press adds the hour.
The dashboard updates instantly for reception, and the notifications reschedule
themselves. The extension fee is collected at pickup like any other charge.

Turn it off, or change the length, under **Settings → Guardian self-extension**.

### After the visit: "How was your visit?"

Shortly after checkout (45 minutes by default) she receives a link asking for a
1–5 rating and *"how can we serve you better?"*. Each link works once. Managers see
the average, the star spread, the response rate and the latest comments on the
**Insights** screen.

---

## 8) Party & workshop bookings

Bookings live on the **Bookings** screen, and customers can book themselves.

- **Share the link.** The Bookings screen shows your public booking link plus a QR
  code — put it in your bio, a story, or on a printed card.
- **What she picks:** party or workshop → a date from the calendar → an available
  time → number of children, theme, and catering. The price updates as she chooses,
  and she confirms with your terms linked in the consent line.
- **Two people can never take the same slot.** The database itself refuses the
  second one, even if both press confirm at the same instant. A taken slot
  immediately shows as booked for everyone else.
- **Payment is collected at the centre.** A new booking arrives as *Awaiting
  confirmation*; a manager presses **Confirm booking**, and **Mark as paid** once
  settled. Cancelling frees the slot again.
- Reception can see bookings; creating, confirming and settling them is a manager's job.

Pricing, durations, available times, themes and catering options are all editable
under **Settings → Party & workshop settings**.

---

## 9) Settings (manager)

On the **Settings** screen a manager can:
- Edit **play durations and prices**, at any time.
- Set the **overtime rate** per minute (set it to zero to disable it).
- Set the **terms page link** that appears inside the consent statement on the
  registration and booking forms.
- Configure **parties and workshops**: base price, price per child, min/max children,
  duration, available time slots, and how much notice a booking needs.
- Turn **visit reviews** on/off and choose how long after checkout to ask.
- Turn **guardian self-extension** on/off and set the extension length.
- Edit the **WhatsApp message templates** (welcome / ending-soon / overtime / review).
- Change the **centre branding** (name, tagline, primary colour).

## 10) Finance & Insights (manager only)

**Finance** shows revenue split across your three income sources — play time,
parties, and workshops — alongside expenses, net profit, and the transaction ledger.

**Insights** answers the operational questions: which day and hour are busiest,
how traffic spreads across the week, which durations sell, how many customers are
new vs returning, your children's age and gender mix, and how revenue is trending
month over month.

### Exporting to Excel

Both screens have an **Export to Excel** button. Choose a report — full, visits,
customers & children, parties & workshops, expenses, or reviews — and it downloads
a real `.xlsx` for the selected period, laid out right-to-left in Arabic. The full
report includes a summary sheet with the headline figures.

Receptionists cannot open Finance, Insights, or the exports — those carry every
customer phone number and the whole financial picture.

---

### Tips
- The dashboard stays live and in sync across all staff devices simultaneously.
- Time and notifications are computed on the server, so they don't depend on a device's clock accuracy.
- **On a phone:** the top navigation becomes a **side drawer**, opened from the ☰ button
  in the header — it holds every page plus the language switch and Log out. Every screen
  is built to work cleanly down to a 360px-wide phone.

Enjoy! 🌟
