<template>
  <div class="wrap screen-in">
    <header class="page-head">
      <div>
        <h1 class="h1">{{ t('bk_title') }}</h1>
        <p class="sub">{{ t('bk_sub') }}</p>
      </div>
      <button v-if="auth.isManager" class="fc-btn fc-btn-primary new-btn" @click="openNew">
        + {{ t('bk_new') }}
      </button>
    </header>

    <!-- Share link: the whole point of item "رابط لحجز الحفلات". -->
    <section class="fc-card share">
      <div class="share-txt">
        <div class="share-lbl">{{ t('bk_link') }}</div>
        <div class="share-url" dir="ltr">{{ bookUrl }}</div>
        <p class="share-hint">{{ t('bk_qr_hint') }}</p>
        <div class="share-btns">
          <button class="fc-btn fc-btn-ghost" @click="copyLink">{{ t('bk_copy') }}</button>
          <a class="fc-btn fc-btn-ghost" :href="bookUrl" target="_blank" rel="noopener">{{ t('pb_title') }}</a>
        </div>
      </div>
      <img v-if="qr" class="share-qr" :src="qr" alt="QR" width="132" height="132" />
    </section>

    <div class="filters">
      <button v-for="f in FILTERS" :key="f" class="fbtn" :class="{ on: filter === f }" @click="setFilter(f)">
        {{ f === 'all' ? t('filter_all') : t(`bk_st_${f}`) }}
      </button>
    </div>

    <div v-if="loading" class="pub-center"><div class="fc-spin"></div></div>
    <div v-else-if="!shown.length" class="empty fc-card">{{ t('bk_empty') }}</div>

    <div v-else class="list">
      <article v-for="b in shown" :key="b.id" class="fc-card bk" :class="b.status">
        <div class="bk-head">
          <span class="tag" :class="b.type">{{ b.type === 'party' ? t('bk_party') : t('bk_workshop') }}</span>
          <span class="ref" dir="ltr">{{ b.reference }}</span>
          <span class="st" :class="b.status">{{ t(`bk_st_${b.status}`) }}</span>
        </div>

        <div class="bk-when" dir="ltr">{{ fmt(b.starts_at) }}</div>
        <div class="bk-who">{{ b.guardian_name }} · <span dir="ltr">{{ b.phone }}</span></div>

        <dl class="bk-meta">
          <div><dt>{{ t('bk_children') }}</dt><dd>{{ b.children_count }}</dd></div>
          <div v-if="b.theme"><dt>{{ t('bk_theme') }}</dt><dd>{{ themeLabel(b.theme) }}</dd></div>
          <div v-if="b.food"><dt>{{ t('bk_food') }}</dt><dd>{{ foodLabel(b.food) }}</dd></div>
          <div><dt>{{ t('bk_amount') }}</dt><dd class="amt">{{ b.amount }} {{ currency }}</dd></div>
          <div><dt>{{ t('bk_payment') }}</dt><dd>{{ t(`bk_pay_${b.payment_status}`) }}</dd></div>
        </dl>

        <p v-if="b.notes" class="bk-notes">{{ b.notes }}</p>

        <div v-if="auth.isManager" class="bk-acts">
          <button v-if="b.status === 'pending'" class="fc-btn fc-btn-play sm" @click="setStatus(b, 'confirmed')">{{ t('bk_confirm') }}</button>
          <button v-if="b.payment_status !== 'paid'" class="fc-btn fc-btn-ghost sm" @click="markPaid(b)">{{ t('bk_mark_paid') }}</button>
          <button v-if="b.status !== 'cancelled'" class="fc-btn fc-btn-ghost sm danger" @click="setStatus(b, 'cancelled')">{{ t('bk_cancel') }}</button>
        </div>
      </article>
    </div>

    <!-- ------------------------- new booking ------------------------- -->
    <Teleport to="body">
      <div v-if="showNew" class="modal-scrim" @click.self="showNew = false">
        <div class="modal fc-card" role="dialog" :aria-label="t('bk_new')">
          <h2 class="m-h">{{ t('bk_new') }}</h2>

          <label class="lbl">{{ t('bk_type') }}</label>
          <div class="seg">
            <button v-for="k in ['party', 'workshop']" :key="k" type="button" class="seg-btn" :class="{ on: form.type === k }" @click="changeType(k)">
              {{ k === 'party' ? t('bk_party') : t('bk_workshop') }}
            </button>
          </div>

          <div class="two">
            <div>
              <label class="lbl" for="nb-d">{{ t('bk_date') }}</label>
              <input id="nb-d" v-model="form.date" class="fc-input" type="date" dir="ltr" :min="todayIso" @change="loadSlots" />
            </div>
            <div>
              <label class="lbl" for="nb-s">{{ t('bk_slot') }}</label>
              <select id="nb-s" v-model="form.slot" class="fc-input" dir="ltr">
                <option value="">—</option>
                <option v-for="sl in slots" :key="sl.slot" :value="sl.slot" :disabled="!sl.available">
                  {{ sl.slot }}{{ sl.available ? '' : ` (${t('bk_taken')})` }}
                </option>
              </select>
            </div>
          </div>

          <div class="two">
            <div>
              <label class="lbl" for="nb-g">{{ t('bk_guardian') }}</label>
              <input id="nb-g" v-model="form.guardian_name" class="fc-input" />
            </div>
            <div>
              <label class="lbl" for="nb-p">{{ t('bk_phone') }}</label>
              <input id="nb-p" v-model="form.phone" class="fc-input" dir="ltr" inputmode="tel" />
            </div>
          </div>

          <div class="two">
            <div>
              <label class="lbl" for="nb-c">{{ t('bk_children') }}</label>
              <input id="nb-c" v-model.number="form.children_count" class="fc-input" type="number" inputmode="numeric" min="1" />
            </div>
            <div>
              <label class="lbl" for="nb-t">{{ t('bk_theme') }}</label>
              <select id="nb-t" v-model="form.theme" class="fc-input">
                <option value="">—</option>
                <option v-for="th in themes" :key="th.key" :value="th.key">{{ th[ui.locale] || th.en }}</option>
              </select>
            </div>
          </div>

          <label class="lbl" for="nb-f">{{ t('bk_food') }}</label>
          <select id="nb-f" v-model="form.food" class="fc-input">
            <option value="">—</option>
            <option v-for="f in foods" :key="f.key" :value="f.key">{{ f[ui.locale] || f.en }}</option>
          </select>

          <label class="lbl" for="nb-n">{{ t('bk_notes') }}</label>
          <textarea id="nb-n" v-model="form.notes" class="pub-area" rows="2"></textarea>

          <div class="m-acts">
            <button class="fc-btn fc-btn-ghost" @click="showNew = false">{{ t('cancel') }}</button>
            <button class="fc-btn fc-btn-primary" :disabled="!canCreate || saving" @click="create">
              <span v-if="saving" class="fc-spin small"></span>
              <span v-else>{{ t('confirm') }}</span>
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
import QRCode from 'qrcode';
import { useBookingsStore } from '@/stores/bookings.js';
import { useSettingsStore } from '@/stores/settings.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const { t } = useI18n();
const store = useBookingsStore();
const settings = useSettingsStore();
const auth = useAuthStore();
const ui = useUiStore();

const FILTERS = ['all', 'pending', 'confirmed', 'cancelled'];
const filter = ref('all');
const loading = ref(true);
const showNew = ref(false);
const saving = ref(false);
const slots = ref([]);
const qr = ref('');

const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const bookUrl = `${window.location.origin}/book`;

const blank = () => ({
  type: 'party', date: '', slot: '', guardian_name: '', phone: '',
  children_count: 10, theme: '', food: '', notes: '',
});
const form = ref(blank());

const cfg = computed(() => settings.data?.booking_config || {});
const themes = computed(() => cfg.value.themes || []);
const foods = computed(() => cfg.value.foods || []);
const currency = computed(() => settings.data?.currency || 'SAR');

const shown = computed(() => (filter.value === 'all'
  ? store.list
  : store.list.filter((b) => b.status === filter.value)));

const canCreate = computed(() => Boolean(
  form.value.date && form.value.slot
  && form.value.guardian_name.trim().length >= 2
  && form.value.phone.trim().length >= 6
  && form.value.children_count > 0,
));

const themeLabel = (k) => themes.value.find((x) => x.key === k)?.[ui.locale] || k;
const foodLabel = (k) => foods.value.find((x) => x.key === k)?.[ui.locale] || k;

function fmt(iso) {
  return new Date(iso).toLocaleString(ui.locale === 'ar' ? 'ar-SA' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh',
  });
}

function setFilter(f) { filter.value = f; }

async function load() {
  loading.value = true;
  try {
    await Promise.all([store.fetch(), settings.data ? null : settings.fetch()]);
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    loading.value = false;
  }
}

async function loadSlots() {
  if (!form.value.date) { slots.value = []; return; }
  try {
    const data = await store.availability(form.value.type, form.value.date);
    slots.value = data.slots || [];
  } catch {
    slots.value = [];
  }
}

function changeType(k) {
  form.value.type = k;
  form.value.slot = '';
  loadSlots();
}

function openNew() {
  form.value = blank();
  slots.value = [];
  showNew.value = true;
}

async function create() {
  if (!canCreate.value || saving.value) return;
  saving.value = true;
  try {
    await store.create({
      ...form.value,
      theme: form.value.theme || null,
      food: form.value.food || null,
      notes: form.value.notes.trim() || null,
    });
    showNew.value = false;
    ui.toast(t('bk_created'), 'success');
    await store.fetch();
  } catch (err) {
    ui.toast(err?.response?.status === 409 ? t('bk_conflict') : t('error_generic'), 'error');
    loadSlots();
  } finally {
    saving.value = false;
  }
}

async function setStatus(b, status) {
  try {
    await store.update(b.id, { status });
    ui.toast(t('bk_updated'), 'success');
  } catch (err) {
    ui.toast(err?.response?.status === 409 ? t('bk_conflict') : t('error_generic'), 'error');
  }
}

async function markPaid(b) {
  try {
    await store.update(b.id, { payment_status: 'paid', paid_amount: b.amount });
    ui.toast(t('bk_updated'), 'success');
  } catch {
    ui.toast(t('error_generic'), 'error');
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(bookUrl);
    ui.toast(t('bk_copied'), 'success');
  } catch {
    ui.toast(t('error_generic'), 'error');
  }
}

onMounted(async () => {
  load();
  try {
    qr.value = await QRCode.toDataURL(bookUrl, { margin: 1, width: 180, color: { dark: '#231F1B', light: '#ffffff' } });
  } catch {
    qr.value = '';
  }
});
</script>

<style scoped>
.wrap { width: 100%; padding: 26px 28px 48px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.h1 { font-family: var(--font-head); font-weight: 800; font-size: clamp(22px, 3vw, 28px); color: var(--ink); margin: 0; }
.sub { color: var(--muted-2); font-size: 14.5px; margin: 6px 0 0; }
.new-btn { height: 48px; padding: 0 20px; }

.share { display: flex; align-items: center; gap: 20px; padding: 20px; margin-bottom: 20px; }
/* Capped so the QR stays beside its text instead of being flung to the far edge
   of a 1900px card with a corridor of white between them. */
.share-txt { flex: 0 1 760px; min-width: 0; }
.share-lbl { font-weight: 800; color: var(--ink); font-size: 15px; }
.share-url { font-size: 13.5px; color: var(--accent); margin-top: 6px; overflow-wrap: anywhere; }
.share-hint { font-size: 12.5px; color: var(--muted-3); margin: 8px 0 0; line-height: 1.5; }
.share-btns { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.share-btns .fc-btn { height: 42px; padding: 0 16px; }
.share-qr { flex: none; border: 2px solid var(--line-soft); border-radius: 14px; padding: 8px; background: #fff; }

.filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.fbtn {
  height: 42px; padding: 0 16px; border-radius: 12px; cursor: pointer;
  border: 2px solid var(--line-3); background: #fff; color: var(--muted-strong);
  font-family: var(--font-body); font-weight: 700; font-size: 14px;
}
.fbtn.on { background: var(--ink); border-color: var(--ink); color: #fff; }

.empty { padding: 40px; text-align: center; color: var(--muted-2); }
.list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }

.bk { padding: 18px; }
.bk.cancelled { opacity: .6; }
.bk-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tag { font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px; }
.tag.party { background: #EFEAFB; color: var(--purple); }
.tag.workshop { background: #DCF0EC; color: #0E8C7E; }
.ref { font-size: 12.5px; color: var(--muted-3); font-weight: 700; }
.st { margin-inline-start: auto; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px; background: var(--chip); color: var(--muted-strong); }
.st.confirmed { background: #EAF7F4; color: #0E8C7E; }
.st.cancelled { background: #FDECEC; color: var(--over); }

.bk-when { font-family: var(--font-head); font-weight: 800; font-size: 18px; color: var(--ink); margin-top: 12px; }
.bk-who { font-size: 14px; color: var(--muted-2); margin-top: 4px; overflow-wrap: anywhere; }
.bk-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin: 14px 0 0; }
.bk-meta div { display: flex; justify-content: space-between; gap: 8px; }
.bk-meta dt { font-size: 12.5px; color: var(--muted-3); }
.bk-meta dd { margin: 0; font-size: 13px; font-weight: 700; color: var(--ink); }
.bk-meta .amt { color: var(--accent); }
.bk-notes { font-size: 13px; color: var(--muted-2); background: var(--chip); padding: 9px 12px; border-radius: 10px; margin: 12px 0 0; }
.bk-acts { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.sm { height: 40px; padding: 0 14px; font-size: 13.5px; }
.danger { color: var(--over); }

/* modal */
.modal-scrim {
  position: fixed; inset: 0; z-index: 60; background: rgba(44, 38, 32, .5);
  display: flex; align-items: center; justify-content: center; padding: 16px;
  overflow-y: auto;
}
.modal { width: min(560px, 100%); padding: 24px; background: var(--surface); max-height: 92vh; overflow-y: auto; }
.m-h { font-family: var(--font-head); font-weight: 800; font-size: 20px; margin: 0 0 16px; }
.lbl { display: block; font-size: 13px; font-weight: 700; color: var(--muted-strong); margin: 14px 0 6px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.seg { display: flex; gap: 8px; }
.seg-btn {
  flex: 1; height: 46px; border: 2px solid var(--line-3); border-radius: 13px; background: #fff;
  font-family: var(--font-body); font-weight: 700; font-size: 14.5px; color: var(--muted-strong); cursor: pointer;
}
.seg-btn.on { border-color: var(--brand); background: #FFF3ED; color: var(--accent); }
.m-acts { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; }
.m-acts .fc-btn { height: 46px; padding: 0 22px; }
.fc-spin.small { width: 20px; height: 20px; border-width: 3px; }

@media (max-width: 860px) {
  .wrap { padding: 20px 14px 40px; }
  .share { flex-direction: column; align-items: stretch; }
  .share-qr { align-self: center; }
  .list { grid-template-columns: 1fr; }
  .new-btn { width: 100%; }
}
@media (max-width: 520px) {
  .two { grid-template-columns: 1fr; gap: 0; }
  .bk-meta { grid-template-columns: 1fr; }
}
</style>
