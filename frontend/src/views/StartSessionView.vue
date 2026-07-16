<template>
  <div class="ss screen-in">
    <!-- Header: back + title + stepper -->
    <div class="ss-head">
      <button class="ss-back-btn" @click="back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
          <path :d="backChevron" />
        </svg>
      </button>
      <div class="ss-title">{{ t('ss_title') }}</div>
      <div class="ss-spacer"></div>
      <div class="ss-steps">
        <template v-for="(s, i) in steps" :key="s.n">
          <div class="ss-step">
            <div class="step-num" :class="s.state">
              <svg v-if="s.state === 'done'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6 9 17l-5-5" /></svg>
              <span v-else>{{ s.n }}</span>
            </div>
            <span class="step-label" :class="s.state">{{ s.label }}</span>
          </div>
          <div v-if="i < steps.length - 1" class="step-conn"></div>
        </template>
      </div>
    </div>

    <!-- Body -->
    <div class="ss-body">
      <div class="ss-inner">

        <!-- STEP 1: customer -->
        <template v-if="step === 1">
          <template v-if="!customer">
            <!-- Scan card -->
            <div class="scan-card">
              <template v-if="!scanning">
                <div class="scan-ic">
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M20 14v3M17 20h3v-3M14 20h.01" /></svg>
                </div>
                <div class="scan-title">{{ t('ss_scan') }}</div>
                <div class="scan-hint">{{ t('ss_scan_hint') }}</div>
                <button class="scan-btn" @click="scanning = true">{{ t('ss_scan_btn') }}</button>
                <p v-if="scanError" class="scan-err" role="alert">{{ t(scanError) }}</p>
              </template>

              <QrScanner v-else @detected="onScanned" @cancel="scanning = false" />
            </div>

            <!-- Divider -->
            <div class="ss-or">
              <div class="ss-or-line"></div>
              <span class="ss-or-txt">{{ t('ss_or') }}</span>
              <div class="ss-or-line"></div>
            </div>

            <!-- Search -->
            <div class="search-wrap">
              <span class="search-ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B7A88F" stroke-width="2.2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
              </span>
              <input
                ref="searchInput"
                v-model="search"
                class="search-input"
                :placeholder="t('ss_search_ph')"
                @input="onSearchInput"
              />
            </div>

            <!-- Results -->
            <div class="results">
              <button
                v-for="r in results"
                :key="r.id"
                class="result-row"
                @click="selectCustomer(r.id)"
              >
                <div class="result-avatar" :style="{ background: avatarColor(r.full_name) }">{{ initial(r.full_name) }}</div>
                <div class="result-main">
                  <div class="result-name">{{ r.full_name }}</div>
                  <div class="result-phone" dir="ltr">{{ r.phone }}</div>
                </div>
                <div class="count-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
                  {{ r.children_count }}
                </div>
                <svg class="result-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C6B49A" stroke-width="2.4"><path :d="fwdChevron" /></svg>
              </button>

              <div v-if="noResults" class="no-match">
                <div class="no-match-title">{{ t('ss_no_match') }}</div>
                <button class="register-link" @click="goRegister">{{ t('ss_register_link') }}</button>
              </div>
            </div>
          </template>

          <!-- Matched customer -->
          <template v-else>
            <div class="matched-pill">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--play)" stroke-width="2.6"><path d="M20 6 9 17l-5-5" /></svg>
              {{ t('ss_matched') }}
            </div>
            <div class="cust-card">
              <div class="cust-top">
                <div class="cust-avatar" :style="{ background: avatarColor(customer.full_name) }">{{ initial(customer.full_name) }}</div>
                <div class="cust-info">
                  <div class="cust-name">{{ customer.full_name }}</div>
                  <div class="cust-phone" dir="ltr">{{ customer.phone }}</div>
                </div>
                <button class="change-btn" @click="changeCustomer">{{ t('ss_change_customer') }}</button>
              </div>
              <div class="cust-children">
                <div class="cust-children-lbl">{{ t('ss_reg_children') }}</div>
                <div class="cust-chips">
                  <div v-for="ch in customer.children" :key="ch.id" class="cust-chip">{{ ch.name }}</div>
                </div>
              </div>
            </div>
          </template>
        </template>

        <!-- STEP 2: child + duration -->
        <template v-else-if="step === 2">
          <div class="sec-title">{{ t('ss_pick_child') }}</div>
          <div class="sec-hint">{{ t('ss_pick_child_hint') }}</div>
          <div class="child-grid">
            <button
              v-for="ch in (customer?.children || [])"
              :key="ch.id"
              class="child-card"
              :class="{ selected: selectedChildIds.includes(ch.id) }"
              @click="toggleChild(ch.id)"
            >
              <div class="child-avatar" :style="{ background: avatarColor(ch.name) }">{{ initial(ch.name) }}</div>
              <div class="child-main">
                <div class="child-name">{{ ch.name }}</div>
                <div class="child-meta">{{ (ch.gender === 'm' ? t('boy') : t('girl')) + ' · ' + ch.age + ' ' + t('yrs') }}</div>
              </div>
              <div v-if="selectedChildIds.includes(ch.id)" class="child-check">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
            </button>
          </div>

          <div class="sec-title dur-title">{{ t('ss_pick_duration') }}</div>
          <div class="dur-grid">
            <button
              v-for="d in durations"
              :key="d.min"
              class="dur-card"
              :class="{ selected: durationMin === d.min }"
              @click="durationMin = d.min"
            >
              <div v-if="d.min === 60" class="dur-ribbon">{{ t('ss_most_popular') }}</div>
              <div class="dur-label">{{ durLabel(d.min) }}</div>
              <div class="dur-sub">{{ durSub(d.min) }}</div>
              <div class="dur-price">{{ money(d.price, ui.locale, currency) }}</div>
            </button>
          </div>
        </template>

        <!-- STEP 3: confirm -->
        <template v-else>
          <div class="summary-title">{{ t('ss_summary') }}</div>
          <div class="summary-card">
            <div class="summary-head">
              <div class="summary-avatar" :style="{ background: avatarColor(customer?.full_name) }">{{ initial(customer?.full_name) }}</div>
              <div>
                <div class="summary-mlbl">{{ t('mother') }}</div>
                <div class="summary-mname">{{ customer?.full_name }}</div>
              </div>
            </div>
            <div class="summary-row">
              <span class="summary-k">{{ t('ss_children') }}</span>
              <span class="summary-v">{{ selChildrenText }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-k">{{ t('ss_duration') }}</span>
              <span class="summary-v">{{ durLabel(durationMin) }}</span>
            </div>
            <div class="summary-total">
              <span class="summary-total-k">{{ t('ss_total') }}</span>
              <span class="summary-total-v">{{ money((selectedDuration?.price || 0) * selectedChildIds.length, ui.locale, currency) }}</span>
            </div>
          </div>
          <div class="confirm-hint">{{ t('ss_confirm_hint') }}</div>
        </template>

      </div>
    </div>

    <!-- Sticky footer -->
    <div class="ss-foot">
      <button class="foot-back" @click="back">{{ t('ss_back') }}</button>
      <div class="ss-spacer"></div>
      <button v-if="step === 3" class="foot-start" :disabled="starting" @click="startPlay">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
        {{ t('ss_start_play') }}
      </button>
      <button v-else class="foot-next" :disabled="!stepValid" @click="next">{{ t('ss_next') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useSessionsStore } from '@/stores/sessions.js';
import { useCustomersStore } from '@/stores/customers.js';
import { useSettingsStore } from '@/stores/settings.js';
import { useUiStore } from '@/stores/ui.js';
import { avatarColor, initial } from '@/lib/colors.js';
import { money, durationKey } from '@/lib/time.js';
import QrScanner from '@/components/QrScanner.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const sessions = useSessionsStore();
const customers = useCustomersStore();
const settings = useSettingsStore();
const ui = useUiStore();

const step = ref(1);
const customer = ref(null);          // full customer (with children)
const search = ref('');
const scanning = ref(false);         // camera open?
const scanError = ref('');           // i18n key, shown under the scan card
const results = ref([]);
const searched = ref(false);
const selectedChildIds = ref([]);
const durationMin = ref(null);
const starting = ref(false);
const searchInput = ref(null);

let searchTimer = null;

// Direction-aware chevrons: in RTL "back" points right, "forward" points left.
const backChevron = computed(() => (ui.isAr ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'));
const fwdChevron = computed(() => (ui.isAr ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'));

const steps = computed(() =>
  [
    { n: 1, label: t('ss_s1') },
    { n: 2, label: t('ss_s2') },
    { n: 3, label: t('ss_s3') },
  ].map((s) => ({
    ...s,
    state: s.n < step.value ? 'done' : s.n === step.value ? 'active' : 'todo',
  })),
);

const currency = computed(() => settings.data?.currency || 'SAR');
const durations = computed(() => settings.data?.durations || []);
const selectedDuration = computed(() => durations.value.find((d) => d.min === durationMin.value) || null);

const noResults = computed(() => searched.value && search.value.trim() !== '' && results.value.length === 0);

const selChildrenText = computed(() => {
  if (!customer.value) return '';
  const names = (customer.value.children || [])
    .filter((c) => selectedChildIds.value.includes(c.id))
    .map((c) => c.name);
  return names.join(ui.isAr ? '، ' : ', ');
});

const stepValid = computed(() => {
  if (step.value === 1) return !!customer.value;
  if (step.value === 2) return selectedChildIds.value.length >= 1 && durationMin.value != null;
  return true;
});

function durLabel(min) {
  if (min == null) return '';
  const k = durationKey(min);
  return k ? t(k) : `${min} ${t('mins')}`;
}
function durSub(min) {
  if (min === 30) return t('ss_quick');
  if (min === 60) return t('ss_most_popular');
  if (min === 120) return t('ss_halfday');
  return '';
}

function onSearchInput() {
  clearTimeout(searchTimer);
  const q = search.value.trim();
  searchTimer = setTimeout(async () => {
    if (!q) {
      results.value = [];
      searched.value = false;
      return;
    }
    try {
      results.value = await customers.search(q);
      searched.value = true;
    } catch (e) {
      ui.toast(t('error_generic'), 'error');
    }
  }, 250);
}

/**
 * The card's QR encodes the public card URL (…/c/<token>), so pull the token out
 * of whatever the camera read. Also accepts a bare token, in case a code is
 * printed without the URL around it.
 */
function tokenFromScan(text) {
  const s = String(text || '').trim();
  const inUrl = s.match(/\/c\/([A-Za-z0-9_-]{8,})/);
  if (inUrl) return inUrl[1];
  if (/^[A-Za-z0-9_-]{16,}$/.test(s)) return s;
  return null;
}

async function onScanned(text) {
  scanning.value = false;
  scanError.value = '';
  const qr = tokenFromScan(text);
  if (!qr) {
    scanError.value = 'qr_err_unknown_code';
    return;
  }
  try {
    const found = await customers.lookup({ qr });
    if (!found?.id) {
      scanError.value = 'qr_err_notfound';
      return;
    }
    await selectCustomer(found.id);
  } catch {
    // A 404 here means a real card token that no longer resolves.
    scanError.value = 'qr_err_notfound';
  }
}

async function selectCustomer(id) {
  try {
    customer.value = await customers.get(id);
    selectedChildIds.value = [];
    durationMin.value = null;
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
  }
}

function changeCustomer() {
  customer.value = null;
  selectedChildIds.value = [];
  durationMin.value = null;
}

function toggleChild(id) {
  const i = selectedChildIds.value.indexOf(id);
  if (i >= 0) selectedChildIds.value.splice(i, 1);
  else selectedChildIds.value.push(id);
}

function goRegister() {
  router.push({ name: 'register' });
}

function back() {
  if (step.value > 1) step.value -= 1;
  else router.push({ name: 'dashboard' });
}

function next() {
  if (!stepValid.value) return;
  if (step.value < 3) step.value += 1;
}

async function startPlay() {
  if (starting.value) return;
  starting.value = true;
  try {
    await sessions.start({
      customer_id: customer.value.id,
      child_ids: selectedChildIds.value,
      duration_minutes: durationMin.value,
    });
    ui.toast(t('toast_started'), 'success');
    router.push({ name: 'dashboard' });
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
  } finally {
    starting.value = false;
  }
}

onMounted(async () => {
  try {
    await settings.fetch();
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
  }
  const cid = route.query.customer;
  if (cid) {
    try {
      customer.value = await customers.get(cid);
    } catch (e) {
      ui.toast(t('error_generic'), 'error');
    }
  } else {
    nextTick(() => searchInput.value?.focus());
  }
});
</script>

<style scoped>
.ss {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 132px);
}

/* Header */
.ss-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 28px;
  border-bottom: 1px solid var(--line);
  flex: none;
}
.ss-back-btn {
  width: 44px;
  height: 44px;
  border-radius: 13px;
  border: 2px solid var(--line-4);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.ss-title {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 21px;
  color: var(--ink);
  white-space: nowrap;
}
.ss-spacer { flex: 1; }

.ss-steps { display: flex; align-items: center; gap: 10px; }
.ss-step { display: flex; align-items: center; gap: 9px; }
.step-num {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 14px;
  flex: none;
}
.step-num.done { background: var(--play); color: #fff; }
.step-num.active { background: var(--brand); color: #fff; }
.step-num.todo { background: var(--line-2); color: var(--muted-2); }
.step-label { font-size: 14px; font-weight: 700; white-space: nowrap; }
.step-label.done { color: var(--play); }
.step-label.active { color: var(--ink); }
.step-label.todo { color: var(--muted-2); }
.step-conn { width: 24px; height: 2px; background: var(--line-4); border-radius: 2px; }

/* Body */
.ss-body {
  flex: 1;
  padding: 26px 28px;
  display: flex;
  justify-content: center;
}
.ss-inner { width: 100%; max-width: 720px; }

/* Scan card */
.scan-card {
  background: var(--surface);
  border: 2px dashed #E4A78E;
  border-radius: 24px;
  padding: 30px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.scan-ic {
  width: 92px;
  height: 92px;
  border-radius: 26px;
  background: linear-gradient(135deg, #FFF0E8, #FCE1D4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.scan-title { font-family: var(--font-head); font-weight: 700; font-size: 20px; color: var(--ink); }
.scan-hint { font-size: 14px; color: var(--muted-2); max-width: 360px; line-height: 1.5; }
.scan-err {
  margin: 12px 0 0;
  background: #FEEDEC; color: var(--over);
  font-weight: 700; font-size: 13px; line-height: 1.5;
  padding: 10px 14px; border-radius: 12px;
  max-width: 380px;
}
.scan-btn {
  margin-top: 4px;
  height: 52px;
  padding: 0 26px;
  border: none;
  border-radius: 15px;
  background: var(--ink);
  color: #fff;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}

/* Divider */
.ss-or { display: flex; align-items: center; gap: 14px; margin: 22px 0; }
.ss-or-line { flex: 1; height: 1px; background: var(--line-3); }
.ss-or-txt { color: #B7A88F; font-weight: 700; font-size: 14px; }

/* Search */
.search-wrap { position: relative; }
.search-ic {
  position: absolute;
  inset-inline-start: 16px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  display: flex;
}
.search-input {
  width: 100%;
  height: 58px;
  border: 2px solid var(--line-3);
  border-radius: 16px;
  background: var(--surface);
  padding-inline-start: 48px;
  padding-inline-end: 16px;
  font-family: var(--font-body);
  font-size: 16px;
  color: var(--ink);
  outline: none;
}
.search-input:focus { border-color: var(--brand); }

/* Results */
.results { margin-top: 14px; display: flex; flex-direction: column; gap: 10px; }
.result-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: start;
  background: var(--surface);
  border: 2px solid var(--line-2);
  border-radius: 16px;
  padding: 12px 14px;
  cursor: pointer;
  font-family: var(--font-body);
}
.result-row:hover { border-color: var(--brand); }
.result-avatar {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 20px;
  flex: none;
}
.result-main { flex: 1; min-width: 0; }
.result-name { font-weight: 700; font-size: 16px; color: var(--ink); }
.result-phone { font-size: 13px; color: var(--muted-2); text-align: start; }
.count-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--chip);
  color: var(--muted);
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
  flex: none;
}
.result-chev { flex: none; }

.no-match { text-align: center; padding: 20px; color: var(--muted-2); }
.no-match-title { font-weight: 700; margin-bottom: 8px; }
.register-link {
  color: var(--accent);
  background: none;
  border: none;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  text-decoration: underline;
  font-family: var(--font-body);
}

/* Matched customer */
.matched-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #EAF7F4;
  color: #0E8C7E;
  padding: 7px 14px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 16px;
}
.cust-card {
  background: var(--surface);
  border: 2px solid var(--line-2);
  border-radius: 24px;
  padding: 22px;
}
.cust-top { display: flex; align-items: center; gap: 16px; }
.cust-avatar {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 28px;
  flex: none;
}
.cust-info { flex: 1; min-width: 0; }
.cust-name { font-family: var(--font-head); font-weight: 800; font-size: 22px; color: var(--ink); }
.cust-phone { margin-top: 4px; color: var(--muted-2); font-size: 14px; text-align: start; }
.change-btn {
  height: 42px;
  padding: 0 16px;
  border: 2px solid var(--line-4);
  background: var(--surface);
  border-radius: 12px;
  color: var(--muted-strong);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  flex: none;
}
.cust-children { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line-soft); }
.cust-children-lbl { font-size: 13px; color: var(--muted-2); font-weight: 700; margin-bottom: 10px; }
.cust-chips { display: flex; gap: 10px; flex-wrap: wrap; }
.cust-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--chip);
  border-radius: 12px;
  padding: 8px 14px;
  font-weight: 700;
  color: var(--ink);
}

/* Step 2 */
.sec-title { font-family: var(--font-head); font-weight: 800; font-size: 20px; color: var(--ink); }
.sec-hint { font-size: 14px; color: var(--muted-2); margin-top: 4px; }
.dur-title { margin-top: 26px; }

.child-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px; }
.child-card {
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: start;
  background: var(--surface);
  border: 2px solid var(--line-2);
  border-radius: 18px;
  padding: 14px;
  cursor: pointer;
  font-family: var(--font-body);
}
.child-card.selected { border-color: var(--brand); background: #FFF3EC; }
.child-avatar {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 24px;
  flex: none;
}
.child-main { flex: 1; min-width: 0; }
.child-name { font-family: var(--font-head); font-weight: 700; font-size: 18px; color: var(--ink); }
.child-meta { font-size: 13px; color: var(--muted-2); margin-top: 2px; }
.child-check {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.dur-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; }
.dur-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: var(--surface);
  border: 2px solid var(--line-2);
  border-radius: 18px;
  padding: 18px 12px;
  cursor: pointer;
  font-family: var(--font-body);
  text-align: center;
}
.dur-card.selected { border-color: var(--brand); background: #FFF3EC; }
.dur-ribbon {
  position: absolute;
  top: -11px;
  inset-inline-end: 14px;
  background: var(--brand-2);
  color: #3A2A12;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
}
.dur-label { font-family: var(--font-head); font-weight: 800; font-size: 25px; color: var(--ink); }
.dur-sub { font-size: 13px; color: var(--muted-2); }
.dur-price { margin-top: 6px; font-weight: 800; font-size: 18px; color: var(--accent); }

/* Step 3 */
.summary-title {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 22px;
  color: var(--ink);
  text-align: center;
  margin-bottom: 20px;
}
.summary-card {
  background: var(--surface);
  border: 2px solid var(--line-2);
  border-radius: 24px;
  padding: 24px;
  max-width: 460px;
  margin: 0 auto;
}
.summary-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line-soft);
}
.summary-avatar {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 24px;
  flex: none;
}
.summary-mlbl { font-size: 13px; color: var(--muted-2); }
.summary-mname { font-family: var(--font-head); font-weight: 700; font-size: 19px; color: var(--ink); }
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--line-soft);
}
.summary-k { color: var(--muted-2); font-weight: 600; }
.summary-v { font-weight: 700; color: var(--ink); }
.summary-total { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; }
.summary-total-k { font-weight: 800; font-size: 17px; color: var(--ink); }
.summary-total-v { font-family: var(--font-head); font-weight: 800; font-size: 24px; color: var(--accent); }
.confirm-hint { text-align: center; color: var(--muted-3); font-size: 13px; margin-top: 14px; }

/* Footer */
.ss-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 32px;
  border-top: 1px solid var(--line);
  background: var(--surface-2);
  flex: none;
  position: sticky;
  bottom: 0;
}
.foot-back {
  height: 56px;
  padding: 0 24px;
  border: 2px solid var(--line-4);
  background: var(--surface);
  border-radius: 16px;
  color: var(--ink);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
}
.foot-next {
  height: 56px;
  padding: 0 32px;
  border: none;
  border-radius: 16px;
  background: var(--brand);
  color: #fff;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 12px 24px -12px rgba(249, 122, 83, .7);
}
.foot-next:disabled {
  background: var(--line-2);
  color: var(--muted-3);
  cursor: not-allowed;
  box-shadow: none;
}
.foot-start {
  height: 60px;
  padding: 0 40px;
  border: none;
  border-radius: 18px;
  background: var(--play);
  color: #fff;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 14px 28px -10px rgba(18, 165, 148, .7);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.foot-start:disabled { opacity: .6; cursor: not-allowed; }

@media (max-width: 640px) {
  .ss-head { flex-wrap: wrap; }
  .step-label { display: none; }
  .child-grid { grid-template-columns: 1fr; }
}
</style>
