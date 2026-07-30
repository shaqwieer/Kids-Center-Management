/**
 * Proves the WhatsLoop adapter without touching the network or sending a real
 * message: `globalThis.fetch` is stubbed, so every assertion is about the exact
 * request we put on the wire and how each documented status is handled.
 *
 * Covers: URL/method/headers/body shape, optional channel_id, message-id
 * extraction, the 4096-char cap, phone normalisation through the facade,
 * throw-with-status on 401/403/422, success:false envelopes, and the 429
 * Retry-After path (short wait -> retried once; long wait -> thrown to BullMQ).
 *
 * Run: node scripts/whatsloop-proof.mjs
 */
import assert from 'node:assert/strict';
import { createWhatsloopAdapter } from '../src/whatsapp/providers/whatsloop.js';

let ok = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };

const TOKEN = 'wl_test_token';
const BASE = 'https://blend-play-sip.whatsloop.net/api/v1';

/** Queue up canned responses; record every request the adapter makes. */
function stubFetch(responses) {
  const calls = [];
  const queue = [...responses];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = queue.shift();
    if (!r) throw new Error('unexpected extra fetch call');
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: r.statusText || '',
      headers: { get: (h) => (r.headers || {})[h] ?? null },
      json: async () => r.json,
    };
  };
  return calls;
}

const okBody = (id = 'wamid.TEST123') => ({
  status: 200, json: { success: true, message: 'تم الإرسال', data: id },
});

async function main() {
  const realFetch = globalThis.fetch;

  console.log('\nRequest shape (the contract with WhatsLoop):');
  {
    const calls = stubFetch([okBody()]);
    const a = createWhatsloopAdapter({ token: TOKEN, baseUrl: BASE });
    const { providerMessageId } = await a.send({ to: '966500000000', body: 'مرحباً' });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${BASE}/messages/send-text`);
    pass('POSTs to {baseUrl}/messages/send-text');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
    pass('sends Authorization: Bearer <token>');
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
    pass('sends Content-Type: application/json');
    assert.deepEqual(calls[0].body, { to: '966500000000', message: 'مرحباً' });
    pass('body is exactly { to, message } — no null channel_id');
    assert.equal(providerMessageId, 'wamid.TEST123');
    pass('reads the message id out of the string `data` envelope');
  }

  console.log('\nTrailing slash in the base URL must not double up:');
  {
    const calls = stubFetch([okBody()]);
    const a = createWhatsloopAdapter({ token: TOKEN, baseUrl: `${BASE}/` });
    await a.send({ to: '966500000000', body: 'x' });
    assert.equal(calls[0].url, `${BASE}/messages/send-text`);
    pass('strips the trailing slash');
  }

  console.log('\nOptional channel_id:');
  {
    const calls = stubFetch([okBody()]);
    const a = createWhatsloopAdapter({ token: TOKEN, baseUrl: BASE, channelId: '7' });
    await a.send({ to: '966500000000', body: 'x' });
    assert.equal(calls[0].body.channel_id, 7);
    pass('included as a NUMBER when configured');
  }

  console.log('\nMessage id extraction tolerates an object envelope:');
  for (const [data, expected] of [
    [{ id: 'A' }, 'A'],
    [{ message_id: 'B' }, 'B'],
    [{ key: { id: 'C' } }, 'C'],
    [{ nothing: 1 }, null],
    [undefined, null],
  ]) {
    stubFetch([{ status: 200, json: { success: true, data } }]);
    const a = createWhatsloopAdapter({ token: TOKEN, baseUrl: BASE });
    const res = await a.send({ to: '966500000000', body: 'x' });
    assert.equal(res.providerMessageId, expected);
  }
  pass('id / message_id / key.id resolved; unknown shape -> null, never a throw');

  console.log('\n4096-char cap (WhatsLoop rejects longer bodies):');
  {
    const calls = stubFetch([okBody()]);
    const a = createWhatsloopAdapter({ token: TOKEN, baseUrl: BASE });
    await a.send({ to: '966500000000', body: 'ب'.repeat(5000) });
    assert.equal(calls[0].body.message.length, 4096);
    pass('message truncated to 4096');
  }

  console.log('\nError statuses throw WITH the status (it lands in notifications.error):');
  for (const [status, msg] of [[401, 'غير مصرّح'], [403, 'صلاحيات غير كافية'], [422, 'بيانات غير صالحة']]) {
    stubFetch([{ status, json: { success: false, message: msg } }]);
    const a = createWhatsloopAdapter({ token: TOKEN, baseUrl: BASE });
    await assert.rejects(
      () => a.send({ to: '966500000000', body: 'x' }),
      (e) => e.message.includes(`WhatsLoop error ${status}`) && e.message.includes(msg),
    );
  }
  pass('401 / 403 / 422 throw with status + provider message');

  {
    stubFetch([{ status: 200, json: { success: false, message: 'channel offline' } }]);
    const a = createWhatsloopAdapter({ token: TOKEN, baseUrl: BASE });
    await assert.rejects(() => a.send({ to: '966500000000', body: 'x' }), /channel offline/);
    pass('HTTP 200 with success:false is still a failure');
  }

  console.log('\nRate limiting (30 sends/min):');
  {
    const calls = stubFetch([
      { status: 429, headers: { 'Retry-After': '1' }, json: { success: false, message: 'rate limited' } },
      okBody('wamid.AFTER_WAIT'),
    ]);
    const a = createWhatsloopAdapter({ token: TOKEN, baseUrl: BASE });
    const started = Date.now();
    const res = await a.send({ to: '966500000000', body: 'x' });
    assert.equal(calls.length, 2);
    assert.ok(Date.now() - started >= 900, 'should have waited out Retry-After');
    assert.equal(res.providerMessageId, 'wamid.AFTER_WAIT');
    pass('short Retry-After -> waits and retries once in-process');
  }
  {
    const calls = stubFetch([
      { status: 429, headers: { 'Retry-After': '120' }, json: { success: false, message: 'rate limited' } },
    ]);
    const a = createWhatsloopAdapter({ token: TOKEN, baseUrl: BASE });
    await assert.rejects(() => a.send({ to: '966500000000', body: 'x' }), /WhatsLoop error 429/);
    assert.equal(calls.length, 1);
    pass('long Retry-After -> thrown once, so BullMQ owns the backoff');
  }

  console.log('\nMisconfiguration fails loudly rather than silently:');
  {
    const a = createWhatsloopAdapter({ token: '', baseUrl: BASE });
    await assert.rejects(() => a.send({ to: '9665', body: 'x' }), /WHATSLOOP_TOKEN/);
    pass('missing token throws a named error');
  }

  console.log('\nEnd-to-end through the facade (renders template + normalises phone):');
  {
    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_PROVIDER = 'whatsloop';
    process.env.WHATSLOOP_TOKEN = TOKEN;
    process.env.WHATSLOOP_BASE_URL = BASE;
    // Imported late so env.js picks up the vars set above.
    const { sendWhatsApp, resetAdapter, getAdapter } = await import('../src/whatsapp/index.js');
    resetAdapter(); // getAdapter() memoises — a stale adapter would void every assertion

    assert.equal(getAdapter().name, 'whatsloop');
    pass("provider 'whatsloop' resolves to the WhatsLoop adapter");

    resetAdapter();
    const calls = stubFetch([okBody('wamid.FACADE')]);
    const out = await sendWhatsApp({
      templateType: 'welcome',
      lang: 'ar',
      to: '0501234567',
      vars: { name: 'سارة', code: 'F-100' },
      template: 'أهلاً {الاسم}! رمزك {الرمز}',
    });
    assert.equal(calls[0].body.to, '966501234567');
    pass('local 05x number normalised to 9665x for the API');
    assert.equal(calls[0].body.message, 'أهلاً سارة! رمزك F-100');
    pass('Arabic placeholders rendered before sending');
    assert.equal(out.providerMessageId, 'wamid.FACADE');
    pass('facade returns the provider message id for notifications.provider_message_id');
  }

  globalThis.fetch = realFetch;
  console.log(`\n✅ whatsloop-proof: ${ok} assertions passed (no network, no message sent)\n`);
}

main().catch((e) => { console.error('\n❌ whatsloop-proof failed:', e); process.exit(1); });
