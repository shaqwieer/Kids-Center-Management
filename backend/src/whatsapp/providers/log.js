/**
 * Dev/sandbox adapter: never touches the network. Logs the message and returns
 * a synthetic provider id. Used when WHATSAPP_ENABLED=false or PROVIDER=log,
 * so the whole system runs end-to-end before a real WhatsApp account exists.
 */
export function createLogAdapter() {
  return {
    name: 'log',
    async send({ templateType, lang, to, body }) {
      const id = `log_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      // eslint-disable-next-line no-console
      console.log(
        `\n📱 [WhatsApp:LOG] (${templateType}/${lang}) -> ${to}\n   "${body}"\n   provider_message_id=${id}\n`,
      );
      return { providerMessageId: id };
    },
  };
}
