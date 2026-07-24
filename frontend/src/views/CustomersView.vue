<template>
  <div class="cust-root screen-in">
    <!-- LEFT: customers sidebar -->
    <aside class="sidebar">
      <div class="sb-head">{{ t('pr_customers') }}</div>
      <div class="sb-search">
        <input
          v-model="q"
          class="fc-input"
          :placeholder="t('pr_search_ph')"
          @input="onSearch"
        />
      </div>
      <div class="sb-list">
        <button
          v-for="c in customers.list"
          :key="c.id"
          class="sb-row"
          :class="{ on: c.id === activeId }"
          @click="pick(c.id)"
        >
          <div
            class="fc-avatar sb-av"
            :style="{ background: avatarColor(c.full_name) }"
          >{{ initial(c.full_name) }}</div>
          <div class="sb-meta">
            <div class="sb-name">{{ c.full_name }}</div>
            <div class="sb-sub">{{ c.children_count }} {{ t('pr_children') }}</div>
          </div>
        </button>
        <div v-if="!customers.list.length" class="sb-empty">{{ t('ss_no_match') }}</div>
      </div>
    </aside>

    <!-- MAIN: profile / edit -->
    <main class="main">
      <div v-if="!cust" class="loading-pane">
        <div class="fc-spin"></div>
      </div>

      <template v-else>
        <div class="top-row">
          <!-- Header card -->
          <section class="fc-card header-card">
            <div class="hc-top">
              <div
                class="fc-avatar hc-av"
                :style="{ background: avatarColor(editing ? edit.full_name : cust.full_name) }"
              >{{ initial(editing ? edit.full_name : cust.full_name) }}</div>

              <!-- VIEW -->
              <div v-if="!editing" class="hc-id">
                <div class="hc-name">{{ cust.full_name }}</div>
                <div class="hc-pill"><b>{{ cust.visit_count }}</b> {{ t('pr_visits') }}</div>
              </div>

              <!-- EDIT (name) -->
              <div v-else class="hc-id">
                <input v-model="edit.full_name" class="fc-input" :placeholder="t('rg_full_name_ph')" />
              </div>
            </div>

            <!-- Info tiles / edit fields -->
            <div class="hc-tiles">
              <div class="tile">
                <div class="tile-l">{{ t('pr_phone_l') }}</div>
                <div v-if="!editing" class="tile-v" dir="ltr">{{ cust.phone }}</div>
                <input v-else v-model="edit.phone" class="fc-input sm" dir="ltr" :placeholder="t('rg_phone_ph')" />
              </div>
              <div v-if="editing || cust.national_id" class="tile">
                <div class="tile-l">{{ t('pr_natid') }}</div>
                <div v-if="!editing" class="tile-v" dir="ltr">{{ cust.national_id }}</div>
                <input v-else v-model="edit.national_id" class="fc-input sm" dir="ltr" :placeholder="t('rg_natid_ph')" />
              </div>
            </div>

            <!-- Actions -->
            <div v-if="!editing" class="hc-actions">
              <button class="fc-btn fc-btn-primary act-start" @click="startSession">
                <span class="plus">+</span>{{ t('pr_start') }}
              </button>
              <button class="fc-btn fc-btn-ghost" @click="enterEdit">{{ t('pr_edit') }}</button>
            </div>
            <div v-else class="hc-actions">
              <button class="fc-btn fc-btn-primary act-start" :disabled="saving" @click="save">
                <span v-if="saving" class="fc-spin small"></span>
                <span v-else>{{ t('pr_save') }}</span>
              </button>
              <button class="fc-btn fc-btn-ghost" :disabled="saving" @click="cancelEdit">{{ t('pr_cancel') }}</button>
            </div>
          </section>

          <!-- QR / card -->
          <section class="qr-card">
            <div class="qr-head">
              <BrandLogo :size="26" :show-text="false" />
              <span class="qr-title">{{ t('pr_card') }}</span>
            </div>
            <div class="qr-box">
              <img v-if="qrUrl" :src="qrUrl" alt="QR" width="150" height="150" />
              <div v-else class="qr-ph"></div>
            </div>
            <div class="qr-code" dir="ltr">{{ cust.customer_code }}</div>
            <button class="fc-btn fc-btn-ghost qr-print" @click="printCard">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
              </svg>
              {{ t('pr_print') }}
            </button>
          </section>
        </div>

        <!-- Children -->
        <div class="sec-head">{{ t('pr_children') }}</div>

        <!-- view: grid -->
        <div v-if="!editing" class="children-grid">
          <div v-for="ch in cust.children" :key="ch.id" class="child-tile">
            <div class="fc-avatar ch-av" :style="{ background: avatarColor(ch.name) }">{{ initial(ch.name) }}</div>
            <div class="ch-meta">
              <div class="ch-name">{{ ch.name }}</div>
              <div class="ch-sub">{{ ch.gender === 'f' ? t('girl') : t('boy') }} · {{ ch.age }} {{ t('yrs') }}</div>
            </div>
          </div>
        </div>

        <!-- edit: rows -->
        <div v-else class="children-edit">
          <div v-for="(ch, i) in edit.children" :key="i" class="ce-row">
            <input v-model="ch.name" class="fc-input sm ce-name" :placeholder="t('rg_child_name_ph')" />
            <div class="ce-bd">
              <input
                v-model="ch.birthdate"
                type="date"
                dir="ltr"
                :max="todayIso"
                class="fc-input sm ce-date"
                :aria-label="t('rg_birthdate')"
              />
              <span v-if="displayAge(ch) !== null" class="ce-agepill">{{ displayAge(ch) }} {{ t('yrs') }}</span>
            </div>
            <div class="ce-gender">
              <button
                class="g-btn"
                :class="{ on: ch.gender === 'm' }"
                :style="ch.gender === 'm' ? { background: '#3E97D8', borderColor: '#3E97D8', color: '#fff' } : {}"
                @click="ch.gender = 'm'"
              >{{ t('boy') }}</button>
              <button
                class="g-btn"
                :class="{ on: ch.gender === 'f' }"
                :style="ch.gender === 'f' ? { background: '#EC6A9C', borderColor: '#EC6A9C', color: '#fff' } : {}"
                @click="ch.gender = 'f'"
              >{{ t('girl') }}</button>
            </div>
            <button v-if="edit.children.length > 1" class="ce-remove" :title="t('rg_remove')" @click="removeChild(i)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          </div>
          <button class="fc-btn fc-btn-ghost add-child" @click="addChild">
            <span class="plus">+</span>{{ t('rg_add_child') }}
          </button>
        </div>

        <!-- Visit history (view only) -->
        <template v-if="!editing">
          <div class="sec-head">{{ t('pr_history') }}</div>
          <div v-if="cust.visits && cust.visits.length" class="history">
            <div v-for="(v, i) in cust.visits" :key="i" class="hist-row">
              <div class="fc-avatar hist-av" :style="{ background: avatarColor(v.child) }">{{ initial(v.child) }}</div>
              <div class="hist-meta">
                <div class="hist-child">{{ v.child }}</div>
                <div class="hist-date">{{ formatDate(v.date, ui.locale) }}</div>
              </div>
              <div class="hist-right">
                <div class="hist-played">{{ v.played_minutes }} {{ t('mins') }}</div>
                <div class="hist-of">{{ t('pr_played_of') }} {{ t('pr_of') }} {{ durLabel(v.duration_minutes) }}</div>
              </div>
              <div v-if="v.over" class="hist-over" dir="ltr">+{{ v.late_minutes }} {{ t('mins') }}</div>
            </div>
          </div>
          <div v-else class="no-visits">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C6B49A" stroke-width="1.9">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </svg>
            {{ t('pr_no_visits') }}
          </div>
        </template>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import QRCode from 'qrcode';
import BrandLogo from '@/components/BrandLogo.vue';
import { useCustomersStore } from '@/stores/customers.js';
import { useUiStore } from '@/stores/ui.js';
import { avatarColor, initial } from '@/lib/colors.js';
import { formatDate, durationKey } from '@/lib/time.js';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const customers = useCustomersStore();
const ui = useUiStore();

const q = ref('');
const cust = ref(null);        // fullCustomer detail (view)
const qrUrl = ref('');
const editing = ref(false);
const edit = ref(null);        // editable copy
const saving = ref(false);

const activeId = computed(() => cust.value?.id);

// Date picker upper bound (a child can't be born in the future), in Riyadh.
const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

/** Whole years from an entered birthdate — the live preview beside the field. */
function ageOf(ch) {
  if (!ch.birthdate) return null;
  const bd = new Date(ch.birthdate);
  if (Number.isNaN(bd.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) years -= 1;
  return years >= 0 && years < 130 ? years : null;
}

// Prefer the birthdate-derived age; fall back to a legacy numeric age so a child
// registered before the DOB field existed still shows (and keeps) their age.
function displayAge(ch) {
  const fromBd = ageOf(ch);
  if (fromBd !== null) return fromBd;
  return ch.age != null && ch.age !== '' ? Number(ch.age) : null;
}

function durLabel(min) {
  const k = durationKey(min);
  return k ? t(k) : `${min} ${t('mins')}`;
}

// --- data loading -----------------------------------------------------------
async function loadDetail(id) {
  if (!id) return;
  try {
    cust.value = await customers.get(id);
  } catch {
    ui.toast(t('error_generic'), 'error');
  }
}

// The view is keyed by route.fullPath in App.vue, so it remounts on id change;
// onMounted is the real load driver. The watch keeps spec parity and is a safe
// no-op under the current keying.
watch(() => route.params.id, (id) => { if (id) loadDetail(id); });

// Regenerate the reprintable QR whenever the loaded customer changes.
watch(cust, (c) => {
  if (!c || !c.card_url) { qrUrl.value = ''; return; }
  QRCode.toDataURL(c.card_url, { margin: 1, width: 180, color: { dark: '#231F1B', light: '#ffffff' } })
    .then((u) => { qrUrl.value = u; })
    .catch(() => { qrUrl.value = ''; });
});

onMounted(async () => {
  // Preserve any existing filtered list across remounts (nav clicks remount us).
  if (!customers.list.length) {
    try { await customers.search(''); } catch { ui.toast(t('error_generic'), 'error'); }
  }
  const id = route.params.id || customers.list[0]?.id;
  if (id) await loadDetail(id);
});

// --- sidebar search (debounced ~250ms) --------------------------------------
let searchTimer = null;
function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    try { await customers.search(q.value.trim()); } catch { ui.toast(t('error_generic'), 'error'); }
  }, 250);
}
onBeforeUnmount(() => clearTimeout(searchTimer));

function pick(id) {
  if (id === activeId.value) return;
  router.push({ name: 'customer', params: { id } });
}

function startSession() {
  router.push({ name: 'start', query: { customer: cust.value.id } });
}

// --- edit mode --------------------------------------------------------------
function enterEdit() {
  edit.value = {
    full_name: cust.value.full_name,
    phone: cust.value.phone,
    national_id: cust.value.national_id || '',
    children: (cust.value.children || []).map((c) => ({
      // Keep `age` as a fallback: existing children may have only a numeric age
      // and no birthdate, and we must not wipe it on save.
      id: c.id, name: c.name, birthdate: c.birthdate || '', age: c.age, gender: c.gender || 'm',
    })),
  };
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  edit.value = null;
}

function addChild() {
  edit.value.children.push({ name: '', birthdate: '', age: '', gender: 'm' });
}

function removeChild(i) {
  if (edit.value.children.length > 1) edit.value.children.splice(i, 1);
}

async function save() {
  saving.value = true;
  try {
    await customers.update(cust.value.id, {
      full_name: edit.value.full_name,
      phone: edit.value.phone,
      national_id: edit.value.national_id,
      children: edit.value.children,
    });
    ui.toast(t('pr_updated'), 'success');
    // Reload the detail + refresh the sidebar list.
    await loadDetail(cust.value.id);
    try { await customers.search(q.value.trim()); } catch { /* keep old list on failure */ }
    editing.value = false;
    edit.value = null;
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    saving.value = false;
  }
}

function printCard() {
  window.print();
}
</script>

<style scoped>
.cust-root {
  display: flex;
  height: calc(100vh - 74px);
  min-height: 0;
}

/* ---- Sidebar ---- */
.sidebar {
  width: 264px;
  flex: none;
  border-inline-end: 1px solid var(--line);
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.sb-head {
  padding: 18px 16px 10px;
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 16px;
  color: var(--ink);
}
.sb-search { padding: 0 12px 10px; }
.sb-search .fc-input { height: 44px; font-size: 14px; }
.sb-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 10px 24px;
}
.sb-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 14px;
  padding: 9px 10px;
  cursor: pointer;
  margin-bottom: 2px;
  text-align: start;
  transition: background .12s ease;
}
.sb-row:hover { background: #FBF4EA; }
.sb-row.on { background: #FFF3EC; }
.sb-av {
  width: 42px; height: 42px;
  border-radius: 13px;
  font-size: 19px;
}
.sb-meta { flex: 1; min-width: 0; }
.sb-name {
  font-weight: 700; font-size: 14.5px; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sb-sub { font-size: 12px; color: var(--muted-3); }
.sb-empty {
  padding: 24px 12px; text-align: center;
  color: var(--muted-3); font-size: 13.5px; font-weight: 600;
}

/* ---- Main ---- */
.main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 30px 60px;
}
.loading-pane {
  display: flex; align-items: center; justify-content: center;
  height: 100%;
}

.top-row {
  display: flex;
  gap: 20px;
  align-items: stretch;
  flex-wrap: wrap;
}

/* Header card */
.header-card {
  flex: 1;
  min-width: 300px;
  padding: 22px;
}
.hc-top { display: flex; align-items: center; gap: 16px; }
.hc-av {
  width: 66px; height: 66px;
  border-radius: 20px;
  font-size: 29px;
}
.hc-id { flex: 1; min-width: 0; }
.hc-name {
  font-family: var(--font-head);
  font-weight: 800; font-size: 23px; color: var(--ink);
}
.hc-pill {
  display: inline-flex; align-items: center; gap: 6px;
  background: #EAF7F4; color: #0E8C7E;
  padding: 4px 11px; border-radius: 999px;
  font-weight: 700; font-size: 12.5px; margin-top: 6px;
}
.hc-tiles {
  margin-top: 18px;
  display: flex; gap: 10px; flex-wrap: wrap;
}
.tile {
  flex: 1; min-width: 140px;
  background: var(--chip);
  border-radius: 14px;
  padding: 11px 14px;
}
.tile-l { font-size: 12px; color: var(--muted-2); font-weight: 600; }
.tile-v {
  font-weight: 700; font-size: 15px; color: var(--ink);
  margin-top: 3px; text-align: start;
}
.tile .fc-input.sm { margin-top: 5px; }
.fc-input.sm { height: 44px; font-size: 14px; }
.hc-actions { margin-top: 16px; display: flex; gap: 10px; }
.act-start { flex: 1; height: 50px; }
.hc-actions .fc-btn-ghost { padding: 0 18px; height: 50px; }
.plus { font-size: 20px; line-height: 1; margin-top: -2px; }

/* QR card */
.qr-card {
  width: 236px;
  flex: none;
  background: #fff;
  border: 2px solid var(--line-2);
  border-radius: 24px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 16px 34px -22px rgba(60, 40, 20, .4);
}
.qr-head { display: flex; align-items: center; gap: 7px; margin-bottom: 12px; }
.qr-title { font-size: 12.5px; color: var(--muted-2); font-weight: 700; }
.qr-box {
  padding: 9px; background: #fff;
  border: 2px solid var(--line-soft);
  border-radius: 14px;
}
.qr-box img { display: block; width: 150px; height: 150px; }
.qr-ph { width: 150px; height: 150px; background: #FBF6EC; border-radius: 6px; }
.qr-code {
  font-family: var(--font-head);
  font-weight: 800; font-size: 19px; color: var(--accent);
  letter-spacing: 1.5px; margin-top: 12px;
}
.qr-print { margin-top: 12px; width: 100%; height: 44px; color: var(--muted-strong); font-size: 13.5px; }

/* Section headings */
.sec-head {
  font-family: var(--font-head);
  font-weight: 800; font-size: 18px; color: var(--ink);
  margin: 26px 0 12px;
}

/* Children (view) */
.children-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.child-tile {
  display: flex; align-items: center; gap: 12px;
  background: #fff;
  border: 2px solid var(--line-2);
  border-radius: 18px;
  padding: 14px;
}
.ch-av { width: 48px; height: 48px; border-radius: 15px; font-size: 22px; }
.ch-meta { flex: 1; min-width: 0; }
.ch-name { font-family: var(--font-head); font-weight: 700; font-size: 17px; color: var(--ink); }
.ch-sub { font-size: 13px; color: var(--muted-2); margin-top: 2px; }

/* Children (edit) */
.children-edit { display: flex; flex-direction: column; gap: 10px; }
.ce-row {
  display: flex; align-items: center; gap: 10px;
  background: #fff;
  border: 2px solid var(--line-2);
  border-radius: 16px;
  padding: 10px 12px;
  flex-wrap: wrap;
}
.ce-name { flex: 1; min-width: 140px; }
.ce-bd { display: flex; align-items: center; gap: 8px; flex: none; }
.ce-date { width: 150px; flex: none; }
.ce-agepill {
  background: var(--chip);
  color: var(--muted-strong);
  font-size: 12px; font-weight: 700;
  padding: 4px 9px; border-radius: 999px;
  white-space: nowrap;
}
.ce-gender { display: flex; gap: 6px; }
.g-btn {
  height: 44px; padding: 0 16px;
  border: 2px solid var(--line-4);
  background: #fff;
  border-radius: 12px;
  font-family: var(--font-body);
  font-weight: 700; font-size: 14px; color: var(--muted-strong);
  cursor: pointer;
  transition: all .12s ease;
}
.ce-remove {
  width: 44px; height: 44px; flex: none;
  border: 2px solid var(--line-4);
  background: #fff;
  border-radius: 12px;
  color: var(--over);
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.ce-remove:hover { border-color: var(--over); }
.add-child { align-self: flex-start; height: 46px; padding: 0 18px; }

/* Visit history */
.history { display: flex; flex-direction: column; gap: 10px; }
.hist-row {
  display: flex; align-items: center; gap: 14px;
  background: #fff;
  border: 1px solid var(--line-2);
  border-radius: 16px;
  padding: 13px 16px;
}
.hist-av { width: 40px; height: 40px; border-radius: 12px; font-size: 18px; }
.hist-meta { flex: 1; min-width: 0; }
.hist-child { font-weight: 700; font-size: 15px; color: var(--ink); }
.hist-date { font-size: 12.5px; color: var(--muted-3); margin-top: 2px; }
.hist-right { text-align: end; }
.hist-played { font-weight: 700; font-size: 14px; color: var(--ink); }
.hist-of { font-size: 12px; color: var(--muted-3); }
.hist-over {
  background: #FEEDEC; color: var(--over);
  font-weight: 700; font-size: 12px;
  padding: 4px 9px; border-radius: 999px;
  margin-inline-start: 4px;
}
.no-visits {
  display: flex; align-items: center; gap: 12px;
  background: #FBF6EC;
  border: 1px dashed #E4D3B0;
  border-radius: 16px;
  padding: 18px;
  color: #A2917A; font-weight: 600; font-size: 14px;
}

.fc-spin.small { width: 22px; height: 22px; border-width: 3px; border-top-color: #fff; }

/* Print: best-effort — isolate the QR card (global AppHeader/toast can't be
   reached from scoped styles, so this is partial by design). */
@media print {
  .cust-root { display: block; height: auto; }
  .sidebar,
  .header-card,
  .sec-head,
  .children-grid,
  .children-edit,
  .history,
  .no-visits { display: none !important; }
  .main { overflow: visible; padding: 0; }
  .top-row { display: block; }
  .qr-card {
    width: 260px;
    margin: 0 auto;
    box-shadow: none;
    border-color: #ccc;
  }
  .qr-print { display: none !important; }
}
</style>
