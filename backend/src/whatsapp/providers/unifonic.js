/**
 * Unifonic (Saudi BSP) WhatsApp adapter (stub demonstrating the swap-in pattern).
 * Requires UNIFONIC_* env to actually send. Shape mirrors the common interface;
 * endpoint/payload should be finalised against your Unifonic account contract.
 */
export function createUnifonicAdapter(cfg) {
  const { appSid, senderId } = cfg;

  return {
    name: 'unifonic',
    async send({ to, body }) {
      if (!appSid) {
        throw new Error('Unifonic not configured (UNIFONIC_APP_SID)');
      }
      const res = await fetch('https://el.cloud.unifonic.com/rest/WhatsApp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ AppSid: appSid, SenderID: senderId, Recipient: to, Body: body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Unifonic error ${res.status}`);
      return { providerMessageId: data?.data?.MessageID || data?.MessageID || null };
    },
  };
}
