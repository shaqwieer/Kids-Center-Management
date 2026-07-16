<template>
  <div class="screen-in fin-wrap">
    <div class="fin-inner">
      <!-- Header -->
      <div class="fin-head">
        <div class="fin-head-titles">
          <div class="fin-title">{{ t('fin_title') }}</div>
          <div class="fin-sub">{{ t('fin_sub') }}</div>
        </div>
        <div class="fin-head-actions">
          <div class="fin-tabs" role="tablist">
            <button
              v-for="p in periods"
              :key="p.key"
              type="button"
              class="fin-tab"
              :class="{ on: finance.period === p.key }"
              @click="load(p.key)"
            >{{ t(p.label) }}</button>
          </div>
          <button type="button" class="fc-btn fc-btn-ghost fin-export" @click="onExport">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2.2"><path d="M12 3v12M8 11l4 4 4-4M4 21h16"/></svg>
            {{ t('fin_export') }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading && !finance.data" class="fin-loading">
        <span class="fc-spin"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <template v-else-if="finance.data">
        <!-- KPI row -->
        <div class="fin-kpis">
          <div class="fin-kpi">
            <div class="fin-kpi-top">
              <span class="fin-kpi-ic" style="background:#EAF7F4;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2.2"><path d="M3 17l6-6 4 4 7-7"/><path d="M15 7h5v5"/></svg>
              </span>
              <span class="fin-kpi-lbl">{{ t('fin_revenue') }}</span>
            </div>
            <div class="fin-kpi-val" dir="ltr">{{ fmt(kpis.revenue) }}</div>
          </div>

          <div class="fin-kpi">
            <div class="fin-kpi-top">
              <span class="fin-kpi-ic" style="background:#FEEDEC;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2.2"><path d="M3 7l6 6 4-4 7 7"/><path d="M15 17h5v-5"/></svg>
              </span>
              <span class="fin-kpi-lbl">{{ t('fin_expenses') }}</span>
              <span class="fin-tag">{{ t('co_future') }}</span>
            </div>
            <div class="fin-kpi-val" dir="ltr">{{ fmt(kpis.expenses) }}</div>
          </div>

          <div class="fin-kpi net">
            <div class="fin-kpi-top">
              <span class="fin-kpi-ic" style="background:rgba(255,255,255,.22);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </span>
              <span class="fin-kpi-lbl">{{ t('fin_net') }}</span>
            </div>
            <div class="fin-kpi-val" dir="ltr">{{ fmt(kpis.net) }}</div>
          </div>

          <div class="fin-kpi">
            <div class="fin-kpi-top">
              <span class="fin-kpi-ic" style="background:#EDE6F7;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C5CE0" stroke-width="2.2"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 6a3 3 0 0 1 0 6M18 20c0-2-1-3.5-2.5-4.3"/></svg>
              </span>
              <span class="fin-kpi-lbl">{{ t('fin_sessions') }}</span>
            </div>
            <div class="fin-kpi-val" dir="ltr">{{ kpis.sessions ?? 0 }}</div>
          </div>
        </div>

        <!-- Weekly bar chart -->
        <div class="fc-card fin-card">
          <div class="fin-card-title">{{ t('fin_weekly') }}</div>
          <div class="fin-bars">
            <div v-for="(b, i) in weekly" :key="i" class="fin-bar-col">
              <div class="fin-bar-track">
                <div
                  class="fin-bar"
                  :style="{ height: barPct(b.amount) + '%', background: b.is_today ? 'var(--brand)' : '#F6C6AE' }"
                  :title="`${b.label} · ${fmt(b.amount)}`"
                ></div>
              </div>
              <div class="fin-bar-lbl">{{ b.label }}</div>
            </div>
          </div>
        </div>

        <!-- Breakdown cards -->
        <div class="fin-breakdowns">
          <!-- Revenue breakdown -->
          <div class="fc-card fin-card">
            <div class="fin-card-head">
              <div class="fin-card-title">{{ t('fin_rev_break') }}</div>
              <span class="fin-card-note">{{ t('fin_month_label') }}</span>
            </div>
            <div v-for="item in revBreak" :key="item.key" class="fin-row">
              <div class="fin-row-top">
                <span class="fin-row-lbl">
                  <span class="fin-dot" :style="{ background: item.color }"></span>{{ t(item.key) }}
                </span>
                <span class="fin-row-val" dir="ltr">
                  {{ fmt(item.amount) }} <span class="fin-pct">· {{ pct(item.amount, totalRevenue) }}%</span>
                </span>
              </div>
              <div class="fin-track">
                <div class="fin-fill" :style="{ width: pct(item.amount, totalRevenue) + '%', background: item.color }"></div>
              </div>
            </div>
          </div>

          <!-- Expenses breakdown -->
          <div class="fc-card fin-card">
            <div class="fin-card-head wrap">
              <div class="fin-card-title">{{ t('fin_exp_break') }}</div>
              <span class="fin-pill">{{ t('fin_placeholder') }}</span>
            </div>
            <div v-for="item in expBreak" :key="item.key" class="fin-row">
              <div class="fin-row-top">
                <span class="fin-row-lbl">
                  <span class="fin-dot" :style="{ background: item.color }"></span>{{ t(item.key) }}
                </span>
                <span class="fin-row-val" dir="ltr">{{ fmt(item.amount) }}</span>
              </div>
              <div class="fin-track">
                <div class="fin-fill" :style="{ width: pct(item.amount, totalExpenses) + '%', background: item.color }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent transactions -->
        <div class="fc-card fin-card">
          <div class="fin-card-head wrap">
            <div class="fin-card-title">{{ t('fin_ledger') }}</div>
            <span v-if="finance.data.placeholder && finance.data.placeholder.expense_transactions" class="fin-pill">{{ t('fin_placeholder') }}</span>
          </div>
          <div v-for="(tx, i) in txns" :key="i" class="fin-txn">
            <span class="fin-txn-ic" :style="{ background: tx.io === 'in' ? '#EAF7F4' : '#FEEDEC' }">
              <svg v-if="tx.io === 'in'" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2.4"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              <svg v-else width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2.4"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </span>
            <div class="fin-txn-body">
              <div class="fin-txn-lbl">{{ tx.label }}</div>
              <div v-if="tx.at" class="fin-txn-when">{{ formatDate(tx.at, ui.locale) }}</div>
            </div>
            <div class="fin-txn-amt" :class="tx.io === 'in' ? 'pos' : 'neg'" dir="ltr">
              {{ (tx.io === 'in' ? '+ ' : '− ') + fmt(tx.amt ?? tx.amount) }}
            </div>
          </div>
          <div v-if="!txns.length" class="fin-empty">{{ t('pr_no_visits') }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFinanceStore } from '@/stores/finance.js';
import { useUiStore } from '@/stores/ui.js';
import { money, formatDate } from '@/lib/time.js';

const { t } = useI18n();
const finance = useFinanceStore();
const ui = useUiStore();

const loading = ref(false);

const periods = [
  { key: 'today', label: 'fin_today' },
  { key: 'week', label: 'fin_week' },
  { key: 'month', label: 'fin_month' },
];

const currency = computed(() => finance.data?.currency || 'SAR');
const kpis = computed(() => finance.data?.kpis || {});
const weekly = computed(() => finance.data?.weekly || []);
const revBreak = computed(() => finance.data?.revenueBreakdown || []);
const expBreak = computed(() => finance.data?.expenses || []);
const txns = computed(() => finance.data?.txns || []);

const maxWeekly = computed(() => Math.max(1, ...weekly.value.map((w) => Number(w.amount) || 0)));
const totalRevenue = computed(() => revBreak.value.reduce((a, b) => a + (Number(b.amount) || 0), 0));
const totalExpenses = computed(
  () => finance.data?.expensesPlaceholderTotal || expBreak.value.reduce((a, b) => a + (Number(b.amount) || 0), 0),
);

function fmt(n) {
  return money(n, ui.locale, currency.value);
}
function pct(amount, total) {
  return total > 0 ? Math.round(((Number(amount) || 0) / total) * 100) : 0;
}
function barPct(amount) {
  return ((Number(amount) || 0) / maxWeekly.value) * 100;
}

async function load(period = finance.period) {
  loading.value = true;
  try {
    await finance.fetch(period, ui.locale);
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
  } finally {
    loading.value = false;
  }
}

function onExport() {
  ui.toast(t('co_future'), 'info');
}

onMounted(() => load('month'));

// Weekday labels come localized from the backend, so refetch on locale change.
watch(() => ui.locale, () => load(finance.period));
</script>

<style scoped>
.fin-wrap { padding: 22px 28px 40px; }
.fin-inner { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

/* Header */
.fin-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.fin-head-titles { min-width: 0; }
.fin-title { font-family: var(--font-head); font-weight: 800; font-size: 28px; color: var(--ink); line-height: 1; }
.fin-sub { font-size: 13px; color: var(--muted-3); margin-top: 5px; }
.fin-head-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-inline-start: auto; }
.fin-tabs { display: flex; gap: 4px; background: var(--line-soft); padding: 5px; border-radius: 14px; }
.fin-tab {
  border: none; background: transparent; cursor: pointer; height: 38px; padding: 0 16px;
  border-radius: 11px; font-family: var(--font-body); font-weight: 700; font-size: 14px; color: var(--muted-strong);
}
.fin-tab.on { background: var(--surface); color: var(--ink); box-shadow: 0 6px 14px -8px rgba(60,40,20,.35); }
.fin-export { height: 48px; }

.fin-loading { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 60px 0; color: var(--muted-2); font-weight: 700; }

/* KPI row */
.fin-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.fin-kpi { background: var(--surface); border: 2px solid var(--line-2); border-radius: 20px; padding: 18px; }
.fin-kpi.net { background: linear-gradient(135deg, #12A594, #0E8C7E); border-color: #0E8C7E; box-shadow: 0 14px 28px -14px rgba(18,165,148,.7); }
.fin-kpi-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fin-kpi-ic { width: 38px; height: 38px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.fin-kpi-lbl { font-size: 13px; color: var(--muted-2); font-weight: 700; }
.fin-kpi.net .fin-kpi-lbl { color: rgba(255,255,255,.9); }
.fin-kpi-val { font-family: var(--font-head); font-weight: 800; font-size: 25px; color: var(--ink); margin-top: 12px; text-align: start; }
.fin-kpi.net .fin-kpi-val { color: #fff; }
.fin-tag { background: rgba(18,165,148,.1); color: #0E8C7E; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; }

/* Cards */
.fin-card { background: var(--surface); border: 2px solid var(--line-2); border-radius: 22px; padding: 22px; }
.fin-card-title { font-family: var(--font-head); font-weight: 800; font-size: 17px; color: var(--ink); }
.fin-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.fin-card-head.wrap { flex-wrap: wrap; }
.fin-card-note { font-size: 12px; color: var(--muted-3); font-weight: 700; }
.fin-pill {
  background: var(--chip); color: var(--muted-strong); font-size: 11.5px; font-weight: 700;
  padding: 4px 11px; border-radius: 999px; border: 1px solid var(--line-3);
}

/* Weekly bars */
.fin-bars { display: flex; align-items: stretch; gap: 10px; height: 170px; }
.fin-bar-col { flex: 1; height: 100%; display: flex; flex-direction: column; align-items: center; }
.fin-bar-track { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; min-height: 0; }
.fin-bar { width: 62%; min-height: 6px; border-radius: 9px 9px 0 0; transition: height .3s ease; }
.fin-bar-lbl { font-size: 11.5px; color: var(--muted-3); font-weight: 700; margin-top: 8px; }

/* Breakdown */
.fin-breakdowns { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.fin-row { margin-bottom: 14px; }
.fin-row:last-child { margin-bottom: 0; }
.fin-row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.fin-row-lbl { display: inline-flex; align-items: center; gap: 9px; font-weight: 700; font-size: 14px; color: var(--ink); }
.fin-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }
.fin-row-val { font-weight: 700; font-size: 14px; color: var(--ink); white-space: nowrap; }
.fin-pct { color: var(--muted-3); font-size: 12px; font-weight: 600; }
.fin-track { height: 9px; background: var(--line-soft); border-radius: 99px; overflow: hidden; }
.fin-fill { height: 100%; border-radius: 99px; transition: width .3s ease; }

/* Ledger */
.fin-txn { display: flex; align-items: center; gap: 14px; padding: 13px 2px; border-bottom: 1px solid var(--line-soft); }
.fin-txn:last-child { border-bottom: none; }
.fin-txn-ic { width: 40px; height: 40px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.fin-txn-body { flex: 1; min-width: 0; }
.fin-txn-lbl { font-weight: 700; font-size: 14.5px; color: var(--ink); }
.fin-txn-when { font-size: 12px; color: var(--muted-3); margin-top: 2px; }
.fin-txn-amt { font-family: var(--font-head); font-weight: 800; font-size: 16px; white-space: nowrap; }
.fin-txn-amt.pos { color: var(--green); }
.fin-txn-amt.neg { color: var(--over); }
.fin-empty { padding: 22px 0; text-align: center; color: var(--muted-2); font-weight: 700; font-size: 14px; }

/* Responsive */
@media (max-width: 900px) {
  .fin-kpis { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 720px) {
  .fin-wrap { padding: 18px 16px 40px; }
  .fin-breakdowns { grid-template-columns: 1fr; }
  .fin-head-actions { margin-inline-start: 0; width: 100%; }
}
@media (max-width: 460px) {
  .fin-kpis { grid-template-columns: 1fr; }
}
</style>
