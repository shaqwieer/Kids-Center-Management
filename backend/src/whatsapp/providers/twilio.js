/**
 * Twilio WhatsApp adapter (stub demonstrating the swap-in pattern).
 * Fully implemented shape; requires TWILIO_* env to actually send. It sends the
 * pre-rendered `body` via Twilio's Messages API using Basic auth.
 */
export function createTwilioAdapter(cfg) {
  const { accountSid, authToken, from } = cfg;

  return {
    name: 'twilio',
    async send({ to, body }) {
      if (!accountSid || !authToken || !from) {
        throw new Error('Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM)');
      }
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const params = new URLSearchParams({
        From: `whatsapp:${from}`,
        To: `whatsapp:+${to}`,
        Body: body,
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Twilio error ${res.status}`);
      return { providerMessageId: data.sid || null };
    },
  };
}
