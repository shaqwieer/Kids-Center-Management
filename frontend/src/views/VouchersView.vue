<template>
  <div class="wrap screen-in">
    <header class="page-head">
      <div>
        <h1 class="h1">{{ t('vc_title') }}</h1>
        <p class="sub">{{ t('vc_sub') }}</p>
      </div>
      <button class="fc-btn fc-btn-primary new-btn" @click="openNew">+ {{ t('vc_new') }}</button>
    </header>

    <div class="filters">
      <button v-for="f in FILTERS" :key="f" class="fbtn" :class="{ on: filter === f }" @click="filter = f">
        {{ f === 'all' ? t('filter_all') : t(`vc_state_${f}`) }}
        <span class="cnt">{{ countOf(f) }}</span>
      </button>
    </div>

    <div v-if="store.loading && !store.list.length" class="pub-center"><div class="fc-spin"></div></div>
    <div v-else-if="!shown.length" class="empty fc-card">{{ t('vc_empty') }}</div>

    <div v-else class="list">
      <article v-for="v in shown" :key="v.id" class="fc-card vc" :class="v.state">
        <div class="vc-head">
          <span class="code" dir="ltr">{{ v.code }}</span>
          <span class="st" :class="v.state">{{ t(`vc_state_${v.state}`) }}</span>
        </div>

        <div class="vc-worth">{{ durText(v.duration_minutes) }}</div>
        <div v-if="v.recipient_name" class="vc-who">{{ t('vc_to') }} {{ v.recipient_name }}</div>

        <dl class="vc-meta">
          <div><dt>{{ t('vc_sold_price') }}</dt><dd class="amt">{{ v.sold_price > 0 ? money(v.sold_price, ui.locale, currency) : t('vc_free') }}</dd></div>
          <div><dt>{{ t('vc_issued') }}</dt><dd dir="ltr">{{ day(v.created_at) }}</dd></div>
          <div v-if="v.buyer_name || v.buyer_phone"><dt>{{ t('vc_buyer') }}</dt><dd>{{ v.buyer_name }} <span dir="ltr">{{ v.buyer_phone }}</span></dd></div>
          <div><dt>{{ t('vc_expires') }}</dt><dd dir="ltr">{{ v.expires_on || '—' }}</dd></div>
          <div v-if="v.redeemed_at" class="full"><dt>{{ t('vc_redeemed_by') }}</dt><dd>{{ v.redeemed_child_name }} · {{ v.redeemed_customer_name }} · <span dir="ltr">{{ day(v.redeemed_at) }}</span></dd></div>
        </dl>

        <p v-if="v.note" class="vc-note">{{ v.note }}</p>

        <div class="vc-acts">
          <a class="fc-btn fc-btn-ghost sm" :href="cardPath(v)" target="_blank" rel="noopener">{{ t('vc_print') }}</a>
          <button class="fc-btn fc-btn-ghost sm" @click="copy(v)">{{ t('vc_copy') }}</button>
          <button v-if="v.state === 'active'" class="fc-btn fc-btn-ghost sm danger" @click="doomed = v">{{ t('vc_cancel') }}</button>
        </div>
      </article>
    </div>

    <!-- ------------------------- issue vouchers ------------------------- -->
    <Teleport to="body">
      <div v-if="doomed" class="modal-scrim" @click.self="doomed = null">
        <div class="modal fc-card" role="dialog" :aria-label="t('vc_cancel')">
          <h2 class="m-h">{{ t('vc_cancel_q', { code: doomed.code }) }}</h2>
          <p class="hint">{{ t('vc_cancel_hint') }}</p>
          <div class="m-acts">
            <button class="fc-btn fc-btn-ghost" @click="doomed = null">{{ t('back') }}</button>
            <button class="fc-btn fc-btn-danger" :disabled="saving" @click="cancel">{{ t('vc_cancel') }}</button>
          </div>
        </div>
      </div>

      <div v-if="showNew" class="modal-scrim" @click.self="showNew = false">
        <div class="modal fc-card" role="dialog" :aria-label="t('vc_new')">
          <h2 class="m-h">{{ t('vc_new') }}</h2>

          <label class="lbl">{{ t('vc_duration') }}</label>
          <div class="seg">
            <button v-for="d in durations" :key="d.min" type="button" class="seg-btn" :class="{ on: form.duration_minutes === d.min }" @click="pickDuration(d)">
              {{ durText(d.min) }}
            </button>
          </div>

          <div class="two">
            <div>
              <label class="lbl" for="vc-p">{{ t('vc_sold_price') }} ({{ currency }})</label>
              <input id="vc-p" v-model.number="form.sold_price" class="fc-input" type="number" inputmode="decimal" min="0" dir="ltr" />
              <p class="hint">{{ t('vc_price_hint') }}</p>
            </div>
            <div>
              <label class="lbl" for="vc-q">{{ t('vc_quantity') }}</label>
              <input id="vc-q" v-model.number="form.quantity" class="fc-input" type="number" inputmode="numeric" min="1" max="50" dir="ltr" />
            </div>
          </div>

          <label class="lbl" for="vc-r">{{ t('vc_recipient') }} <span class="opt">({{ t('optional') }})</span></label>
          <input id="vc-r" v-model="form.recipient_name" class="fc-input" />

          <div class="two">
            <div>
              <label class="lbl" for="vc-b">{{ t('vc_buyer') }} <span class="opt">({{ t('optional') }})</span></label>
              <input id="vc-b" v-model="form.buyer_name" class="fc-input" />
            </div>
            <div>
              <label class="lbl" for="vc-bp">{{ t('vc_buyer_phone') }} <span class="opt">({{ t('optional') }})</span></label>
              <input id="vc-bp" v-model="form.buyer_phone" class="fc-input" dir="ltr" inputmode="tel" />
            </div>
          </div>

          <label class="lbl" for="vc-e">{{ t('vc_expires') }} <span class="opt">({{ t('optional') }})</span></label>
          <input id="vc-e" v-model="form.expires_on" class="fc-input" type="date" dir="ltr" :min="todayIso" />

          <label class="lbl" for="vc-n">{{ t('vc_note') }} <span class="opt">({{ t('optional') }})</span></label>
          <textarea id="vc-n" v-model="form.note" class="pub-area" rows="2" maxlength="500"></textarea>

          <div class="m-acts">
            <button class="fc-btn fc-btn-ghost" @click="showNew = false">{{ t('cancel') }}</button>
            <button class="fc-btn fc-btn-primary" :disabled="!canCreate || saving" @click="create">
              <span v-if="saving" class="fc-spin small"></span>
              <span v-else>{{ t('vc_issue') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useVouchersStore } from '@/stores/vouchers.js';
import { useSettingsStore } from '@/stores/settings.js';
import { useUiStore } from '@/stores/ui.js';
import { money, durationKey } from '@/lib/time.js';

const { t } = useI18n();
const store = useVouchersStore();
const settings = useSettingsStore();
const ui = useUiStore();

const FILTERS = ['all', 'active', 'redeemed', 'expired', 'void'];
const filter = ref('active');
const showNew = ref(false);
const saving = ref(false);
const doomed = ref(null); // voucher awaiting cancel confirmation

const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const currency = computed(() => settings.data?.currency || 'SAR');
// Retired tiers stay in settings only to keep pricing their past visits.
const durations = computed(() => (settings.data?.durations || []).filter((d) => !d.retired));

const blank = () => ({
  duration_minutes: null, sold_price: 0, quantity: 1,
  recipient_name: '', buyer_name: '', buyer_phone: '', expires_on: '', note: '',
});
const form = ref(blank());

const shown = computed(() => (filter.value === 'all' ? store.list : store.list.filter((v) => v.state === filter.value)));
const countOf = (f) => (f === 'all' ? store.list.length : store.list.filter((v) => v.state === f).length);

const canCreate = computed(() => Boolean(
  form.value.duration_minutes != null // 0 = open play
  && Number(form.value.sold_price) >= 0
  && form.value.quantity >= 1 && form.value.quantity <= 50,
));

function durText(min) {
  const k = durationKey(min);
  if (k) return t(k);
  return min % 60 === 0 ? t('vc_hours', { n: min / 60 }) : `${min} ${t('mins')}`;
}

function day(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }) : '';
}

// Same-origin path, so it opens on whatever host reception is using.
const cardPath = (v) => `/v/${v.token}`;

function pickDuration(d) {
  form.value.duration_minutes = d.min;
  // Default the sale price to the reception price; set 0 for a free gift.
  form.value.sold_price = Number(d.price) || 0;
}

function openNew() {
  form.value = blank();
  const first = durations.value[0];
  if (first) pickDuration(first);
  showNew.value = true;
}

async function create() {
  if (!canCreate.value || saving.value) return;
  saving.value = true;
  try {
    const created = await store.create({
      duration_minutes: form.value.duration_minutes,
      sold_price: Number(form.value.sold_price) || 0,
      quantity: form.value.quantity,
      recipient_name: form.value.recipient_name.trim() || null,
      buyer_name: form.value.buyer_name.trim() || null,
      buyer_phone: form.value.buyer_phone.trim() || null,
      expires_on: form.value.expires_on || null,
      note: form.value.note.trim() || null,
    });
    showNew.value = false;
    filter.value = 'active';
    ui.toast(t('vc_created', { n: created.length }), 'success');
    // One voucher: open its card straight away, ready to print or send.
    if (created.length === 1) window.open(cardPath(created[0]), '_blank', 'noopener');
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    saving.value = false;
  }
}

async function cancel() {
  if (!doomed.value || saving.value) return;
  saving.value = true;
  try {
    await store.cancel(doomed.value.id);
    doomed.value = null;
    ui.toast(t('vc_cancelled'), 'success');
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    saving.value = false;
  }
}

async function copy(v) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${cardPath(v)}`);
    ui.toast(t('bk_copied'), 'success');
  } catch {
    ui.toast(t('error_generic'), 'error');
  }
}

onMounted(async () => {
  try {
    await Promise.all([store.fetch(), settings.data ? null : settings.fetch()]);
  } catch {
    ui.toast(t('error_generic'), 'error');
  }
});
</script>

<style scoped>
.wrap { width: 100%; padding: 26px 28px 48px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.h1 { font-family: var(--font-head); font-weight: 800; font-size: clamp(22px, 3vw, 28px); color: var(--ink); margin: 0; }
.sub { color: var(--muted-2); font-size: 14.5px; margin: 6px 0 0; }
.new-btn { height: 48px; padding: 0 20px; }

.filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.fbtn {
  height: 42px; padding: 0 14px; border-radius: 12px; cursor: pointer;
  border: 2px solid var(--line-3); background: #fff; color: var(--muted-strong);
  font-family: var(--font-body); font-weight: 700; font-size: 14px;
  display: inline-flex; align-items: center; gap: 8px;
}
.fbtn.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.cnt { font-size: 12px; opacity: .7; }

.empty { padding: 40px; text-align: center; color: var(--muted-2); }
.list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }

.vc { padding: 18px; }
.vc.void, .vc.expired { opacity: .6; }
.vc-head { display: flex; align-items: center; gap: 8px; }
.code { font-family: var(--font-head); font-weight: 800; font-size: 19px; color: var(--ink); letter-spacing: 1px; }
.st { margin-inline-start: auto; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px; background: var(--chip); color: var(--muted-strong); }
.st.active { background: #EAF7F4; color: #0E8C7E; }
.st.redeemed { background: #EFEAFB; color: var(--purple); }
.st.void, .st.expired { background: #FDECEC; color: var(--over); }

.vc-worth { font-family: var(--font-head); font-weight: 800; font-size: 18px; color: var(--accent); margin-top: 10px; }
.vc-who { font-size: 14px; color: var(--muted-2); margin-top: 2px; overflow-wrap: anywhere; }
.vc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin: 14px 0 0; }
.vc-meta div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.vc-meta .full { grid-column: 1 / -1; }
.vc-meta dt { font-size: 12px; color: var(--muted-3); }
.vc-meta dd { margin: 0; font-size: 13px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.vc-meta .amt { color: var(--accent); }
.vc-note { font-size: 13px; color: var(--muted-2); background: var(--chip); padding: 9px 12px; border-radius: 10px; margin: 12px 0 0; overflow-wrap: anywhere; }
.vc-acts { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.sm { height: 40px; padding: 0 14px; font-size: 13.5px; text-decoration: none; }
.danger { color: var(--over); }

.modal-scrim {
  position: fixed; inset: 0; z-index: 60; background: rgba(44, 38, 32, .5);
  display: flex; align-items: center; justify-content: center; padding: 16px; overflow-y: auto;
}
.modal { width: min(560px, 100%); padding: 24px; background: var(--surface); max-height: 92vh; overflow-y: auto; }
.m-h { font-family: var(--font-head); font-weight: 800; font-size: 20px; margin: 0 0 6px; }
.lbl { display: block; font-size: 13px; font-weight: 700; color: var(--muted-strong); margin: 14px 0 6px; }
.opt { font-weight: 600; color: var(--muted-3); }
.hint { font-size: 12px; color: var(--muted-3); margin: 6px 0 0; line-height: 1.5; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.seg { display: flex; gap: 8px; flex-wrap: wrap; }
.seg-btn {
  flex: 1; min-width: 90px; height: 46px; border: 2px solid var(--line-3); border-radius: 13px; background: #fff;
  font-family: var(--font-body); font-weight: 700; font-size: 14.5px; color: var(--muted-strong); cursor: pointer;
}
.seg-btn.on { border-color: var(--brand); background: #FFF3ED; color: var(--accent); }
.m-acts { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; }
.m-acts .fc-btn { height: 46px; padding: 0 22px; }
.fc-spin.small { width: 20px; height: 20px; border-width: 3px; }

@media (max-width: 860px) {
  .wrap { padding: 20px 16px 40px; }
  .list { grid-template-columns: 1fr; }
  .new-btn { width: 100%; }
}
@media (max-width: 520px) {
  .two { grid-template-columns: 1fr; gap: 0; }
}
</style>
