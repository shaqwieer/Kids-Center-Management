/**
 * Meta WhatsApp Cloud API adapter — sends APPROVED template messages.
 * Requires WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID. Uses global fetch (Node 18+).
 */
import { orderedVars } from '../templates.js';

export function createMetaAdapter(cfg) {
  const { token, phoneNumberId, apiVersion, templates, defaultCountry, langMap } = cfg;
  const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  return {
    name: 'meta',
    async send({ templateType, lang, to, vars }) {
      if (!token || !phoneNumberId) {
        throw new Error('Meta WhatsApp not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
      }
      const templateName = templates[templateType] || templateType;
      const languageCode = (langMap && langMap[lang]) || (lang === 'ar' ? 'ar' : 'en');
      const params = orderedVars(templateType, vars).map((text) => ({ type: 'text', text }));

      const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: params.length
            ? [{ type: 'body', parameters: params }]
            : undefined,
        },
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || `Meta API error ${res.status}`;
        throw new Error(msg);
      }
      const providerMessageId = data?.messages?.[0]?.id || null;
      return { providerMessageId };
    },
  };
}
