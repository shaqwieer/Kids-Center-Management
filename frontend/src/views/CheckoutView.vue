<template>
  <div v-if="session" class="co-page screen-in">
    <!-- Checkout header (below the shared AppHeader) -->
    <div class="co-head">
      <button class="co-back" @click="goBack" :aria-label="t('ss_back')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path :d="backChevron" />
        </svg>
      </button>
      <div class="co-head-title">{{ t('co_title') }}</div>
    </div>

    <!-- Scrollable content -->
    <div class="co-scroll">
      <div class="co-col">
        <div class="co-card">
          <!-- Child + status row -->
          <div class="co-card-head">
            <div class="co-avatar" :style="{ background: avatarColor(childName) }">{{ initial(childName) }}</div>
            <div class="co-who">
              <div class="co-child">{{ childName }}</div>
              <div class="co-mother">{{ t('mother') }}: {{ motherName }}</div>
            </div>
            <div class="co-chip" :style="{ background: statusBg, color: statusColor }">
              <span class="co-chip-dot" :style="{ background: statusColor }"></span>{{ statusText }}
            </div>
          </div>

          <!-- Detail rows -->
          <div class="co-rows">
            <div class="co-row co-row-line">
              <span class="co-label">{{ t('co_chosen') }}</span>
              <span class="co-value">{{ durationLabel }}</span>
            </div>
            <div class="co-row co-row-line">
              <span class="co-label">{{ t('co_actual') }}</span>
              <span class="co-value">{{ playedMin }} {{ t('mins') }}</span>
            </div>
            <div class="co-row">
              <span class="co-label">{{ t('co_window') }}</span>
              <span class="co-value" dir="ltr">{{ startLabel }} — {{ endLabel }}</span>
            </div>
          </div>

          <!-- Fee box -->
          <div class="co-fee">
            <div class="co-fee-row">
              <span class="co-fee-label">{{ t('co_base_fee') }}</span>
              <span class="co-value" dir="ltr">{{ fmtMoney(base) }}</span>
            </div>

            <div class="co-fee-row co-fee-late">
              <div class="co-late-info">
                <span class="co-fee-label co-late-title">
                  {{ t('co_late_fee') }}
                  <span class="co-badge">{{ t('co_future') }}</span>
                </span>
                <span class="co-late-note">{{ t('co_rate_note') }}: {{ fmtMoney(rate) }} / {{ t('mins') }} · {{ t('co_late_hint') }}</span>
              </div>
              <span class="co-value" dir="ltr" :style="{ color: statusColor }">{{ fmtMoney(lateFee) }}</span>
            </div>

            <div class="co-fee-row co-fee-total">
              <span class="co-total-label">{{ t('co_total') }}</span>
              <span class="co-total-value" dir="ltr">{{ fmtMoney(total) }}</span>
            </div>
          </div>

          <div class="co-card-pad"></div>
        </div>
      </div>
    </div>

    <!-- Footer actions -->
    <div class="co-foot">
      <button class="co-btn-back" @click="goBack">{{ t('ss_back') }}</button>
      <div class="co-spacer"></div>
      <button class="co-btn-complete" :disabled="ending" @click="complete">
        <span v-if="ending" class="fc-spin small"></span>
        <template v-else>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {{ t('co_complete') }}
        </template>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useSessionsStore } from '@/stores/sessions.js';
import { useSettingsStore } from '@/stores/settings.js';
import { useUiStore } from '@/stores/ui.js';
import { avatarColor, initial } from '@/lib/colors.js';
import { formatTime, money, durationKey } from '@/lib/time.js';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const sessions = useSessionsStore();
const settings = useSettingsStore();
const ui = useUiStore();

const session = ref(null);
const ending = ref(false);

onMounted(async () => {
  try {
    await settings.fetch();
    session.value = await sessions.get(route.params.id);
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
    router.push({ name: 'dashboard' });
  }
});

// --- currency helper ---
const currency = computed(() => settings.data?.currency || 'SAR');
function fmtMoney(n) { return money(n, ui.locale, currency.value); }

// --- child / customer ---
const childName = computed(() => session.value?.child?.name || '');
const motherName = computed(() => session.value?.customer?.full_name || '');

// --- live preview, derived from sessions.now (ticks every 1s) ---
const startedMs = computed(() => (session.value ? new Date(session.value.started_at).getTime() : 0));
const endsMs = computed(() => (session.value ? new Date(session.value.ends_at).getTime() : 0));

const playedMin = computed(() => {
  if (!session.value) return 0;
  return Math.max(1, Math.ceil((sessions.now - startedMs.value) / 60000));
});
const overMin = computed(() => {
  if (!session.value) return 0;
  return Math.max(0, Math.ceil((sessions.now - endsMs.value) / 60000));
});

const base = computed(() => session.value?.price || 0);
const rate = computed(() => settings.data?.late_fee_per_minute || 0);
const lateFee = computed(() => overMin.value * rate.value);
const total = computed(() => base.value + lateFee.value);
const over = computed(() => overMin.value > 0);

// --- status chip ---
const statusColor = computed(() => (over.value ? '#E5484D' : '#0E8C7E'));
const statusBg = computed(() => (over.value ? '#FEEDEC' : '#EAF7F4'));
const statusText = computed(() =>
  over.value ? `${t('co_over_by')} ${overMin.value} ${t('mins')}` : t('co_ontime'),
);

// --- labels ---
const durationLabel = computed(() => {
  const min = session.value?.duration_minutes;
  const key = durationKey(min);
  return key ? t(key) : `${min} ${t('mins')}`;
});
const startLabel = computed(() => formatTime(startedMs.value, ui.locale));
const endLabel = computed(() => formatTime(sessions.now, ui.locale));

// --- direction-aware back chevron ---
const backChevron = computed(() => (ui.isAr ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'));

// --- actions ---
function goBack() {
  router.push({ name: 'dashboard' });
}

async function complete() {
  if (ending.value) return;
  ending.value = true;
  try {
    await sessions.end(session.value.id);
    ui.toast(t('co_done'), 'success');
    router.push({ name: 'dashboard' });
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
    ending.value = false;
  }
}
</script>

<style scoped>
.co-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* Header */
.co-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 28px;
  border-bottom: 1px solid var(--line);
  flex: none;
}
.co-back {
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
.co-head-title {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 21px;
  color: var(--ink);
}

/* Scroll area */
.co-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 26px 28px;
  display: flex;
  justify-content: center;
}
.co-col {
  width: 100%;
  max-width: 560px;
}

/* Card */
.co-card {
  background: var(--surface);
  border: 2px solid var(--line-2);
  border-radius: 26px;
  overflow: hidden;
  box-shadow: 0 20px 40px -24px rgba(60, 40, 20, 0.4);
}
.co-card-head {
  padding: 22px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--line-soft);
}
.co-avatar {
  width: 60px;
  height: 60px;
  border-radius: 19px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 27px;
  flex: none;
}
.co-who {
  flex: 1;
  min-width: 0;
}
.co-child {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 22px;
  color: var(--ink);
}
.co-mother {
  font-size: 13px;
  color: var(--muted-2);
  margin-top: 2px;
}
.co-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 13.5px;
  white-space: nowrap;
}
.co-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Rows */
.co-rows {
  padding: 6px 22px;
}
.co-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
}
.co-row-line {
  border-bottom: 1px solid #F5EEE1;
}
.co-label {
  color: var(--muted-2);
  font-weight: 600;
  font-size: 15px;
}
.co-value {
  font-weight: 700;
  font-size: 16px;
  color: var(--ink);
}

/* Fee box */
.co-fee {
  margin: 6px 22px 0;
  padding: 16px;
  background: #FBF6EC;
  border: 1px dashed #E4D3B0;
  border-radius: 18px;
}
.co-fee-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.co-fee-row:first-child {
  padding-bottom: 11px;
}
.co-fee-label {
  color: var(--muted-strong);
  font-weight: 600;
  font-size: 15px;
}
.co-fee-late {
  align-items: flex-start;
  padding: 11px 0;
  border-top: 1px solid #EFE0C4;
}
.co-late-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.co-late-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.co-badge {
  background: #EDE6F7;
  color: var(--purple);
  font-size: 10.5px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
}
.co-late-note {
  color: #B7A88F;
  font-size: 12px;
}
.co-fee-total {
  padding-top: 12px;
  border-top: 2px solid #E4D3B0;
}
.co-total-label {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 18px;
  color: var(--ink);
}
.co-total-value {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 26px;
  color: var(--accent);
}
.co-card-pad {
  height: 22px;
}

/* Footer */
.co-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 32px;
  border-top: 1px solid var(--line);
  background: var(--surface-2);
  flex: none;
}
.co-spacer {
  flex: 1;
}
.co-btn-back {
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
.co-btn-complete {
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
  box-shadow: 0 14px 28px -10px rgba(18, 165, 148, 0.7);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.co-btn-complete:disabled {
  opacity: 0.7;
  cursor: default;
}
.fc-spin.small {
  width: 22px;
  height: 22px;
  border-width: 3px;
}
</style>
