/**
 * PAYMENTS — future-ready placeholder (structure only, NOT wired to a live gateway).
 *
 * A PaymentProvider lets late-pickup auto-charge be added later without touching
 * the domain: sessions already compute late_fee; a provider would charge it.
 * Saudi-oriented stubs: Moyasar / HyperPay / Geidea. `settings.payments_enabled`
 * gates activation. None of these make network calls today.
 */

/** @typedef {{ amount:number, currency:string, description?:string, customer?:object, metadata?:object }} ChargeInput */

class PaymentProvider {
  constructor(name) { this.name = name; }
  // eslint-disable-next-line no-unused-vars
  async createCharge(input) { throw new Error(`${this.name}: createCharge not implemented (payments disabled)`); }
  // eslint-disable-next-line no-unused-vars
  async refund(chargeId, amount) { throw new Error(`${this.name}: refund not implemented (payments disabled)`); }
  async capabilities() { return { applePay: true, mada: true, visa: true, currency: 'SAR' }; }
}

class MoyasarProvider extends PaymentProvider { constructor() { super('moyasar'); } }
class HyperPayProvider extends PaymentProvider { constructor() { super('hyperpay'); } }
class GeideaProvider extends PaymentProvider { constructor() { super('geidea'); } }

const REGISTRY = { moyasar: MoyasarProvider, hyperpay: HyperPayProvider, geidea: GeideaProvider };

export function getPaymentProvider(name = 'moyasar') {
  const Ctor = REGISTRY[name] || MoyasarProvider;
  return new Ctor();
}

export { PaymentProvider };
