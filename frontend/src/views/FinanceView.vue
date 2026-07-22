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
          <button v-if="auth.isManager" type="button" class="fc-btn fc-btn-primary exp-add-btn" @click="openExpense()">
            <span class="exp-add-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </span>
            <span>{{ t('exp_add') }}</span>
          </button>
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
          <button type="button" class="fc-btn fc-btn-ghost fin-export" :disabled="exporting" @click="onExport">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2.2"><path d="M12 3v12M8 11l4 4 4-4M4 21h16"/></svg>
            {{ exporting ? t('xl_exporting') : t('xl_export') }}
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
              <span class="fin-card-note">{{ t('fin_period_expenses') }}</span>
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

        <!-- Expense management -->
        <div class="fc-card fin-card">
          <div class="fin-card-head wrap">
            <div class="fin-card-title">{{ t('exp_manage') }}</div>
            <button v-if="auth.isManager" type="button" class="fc-btn fc-btn-primary exp-add-btn" @click="openExpense()">
            <span class="exp-add-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </span>
            <span>{{ t('exp_add') }}</span>
          </button>
          </div>
          <div v-for="item in expenseEntries" :key="item.id" class="fin-txn">
            <span class="fin-txn-ic" style="background:#FEEDEC">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2.4"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </span>
            <div class="fin-txn-body">
              <div class="fin-txn-lbl">{{ item.title }} · {{ t(`e_${item.category}`) }}</div>
              <div class="fin-txn-when">{{ formatDate(item.incurred_at, ui.locale) }}<span v-if="item.notes"> · {{ item.notes }}</span></div>
            </div>
            <div class="fin-txn-amt neg" dir="ltr">− {{ fmt(item.amount) }}</div>
            <div v-if="auth.isManager" class="exp-actions">
              <button type="button" class="exp-icon" :title="t('exp_edit')" @click="openExpense(item)">✎</button>
              <button type="button" class="exp-icon danger" :title="t('exp_delete')" @click="removeExpense(item)">×</button>
            </div>
          </div>
          <div v-if="!expenseEntries.length" class="fin-empty">{{ t('exp_empty') }}</div>
        </div>
        <!-- Recent transactions -->
        <div class="fc-card fin-card">
          <div class="fin-card-head wrap">
            <div class="fin-card-title">{{ t('fin_ledger') }}</div>
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

    <div v-if="expenseForm" class="exp-scrim" @click.self="expenseForm = null">
      <div class="exp-modal fc-card" role="dialog" aria-modal="true">
        <div class="fin-card-head">
          <div class="fin-card-title">{{ expenseForm.id ? t('exp_edit') : t('exp_add') }}</div>
          <button type="button" class="exp-icon" @click="expenseForm = null">×</button>
        </div>
        <form class="exp-form" @submit.prevent="saveExpense">
          <label>{{ t('exp_title') }}<input v-model="expenseForm.title" class="fc-input" required maxlength="160" /></label>
          <label>{{ t('exp_category') }}
            <select v-model="expenseForm.category" class="fc-input">
              <option v-for="category in expenseCategories" :key="category" :value="category">{{ t(`e_${category}`) }}</option>
            </select>
          </label>
          <label>{{ t('exp_amount') }}<input v-model.number="expenseForm.amount" class="fc-input" type="number" min="0.01" step="0.01" required dir="ltr" /></label>
          <label>{{ t('exp_date') }}<input v-model="expenseForm.incurred_at" class="fc-input" type="datetime-local" required dir="ltr" /></label>
          <label>{{ t('exp_notes') }}<textarea v-model="expenseForm.notes" class="fc-input exp-notes" maxlength="2000"></textarea></label>
          <div class="exp-form-actions">
            <button type="button" class="fc-btn fc-btn-ghost" @click="expenseForm = null">{{ t('pr_cancel') }}</button>
            <button type="submit" class="fc-btn fc-btn-primary" :disabled="savingExpense">{{ t('pr_save') }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFinanceStore } from '@/stores/finance.js';
import { useInsightsStore } from '@/stores/insights.js';
import { useUiStore } from '@/stores/ui.js';
import { useAuthStore } from '@/stores/auth.js';
import { money, formatDate } from '@/lib/time.js';

const { t } = useI18n();
const finance = useFinanceStore();
const insights = useInsightsStore();
const ui = useUiStore();
const auth = useAuthStore();

const loading = ref(false);
const exporting = ref(false);
const savingExpense = ref(false);
const expenseForm = ref(null);
const expenseCategories = ['salaries', 'rent', 'supplies', 'utilities', 'marketing', 'maintenance', 'other'];

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
const expenseEntries = computed(() => finance.data?.expenseEntries || []);

const maxWeekly = computed(() => Math.max(1, ...weekly.value.map((w) => Number(w.amount) || 0)));
const totalRevenue = computed(() => revBreak.value.reduce((a, b) => a + (Number(b.amount) || 0), 0));
const totalExpenses = computed(
  () => expBreak.value.reduce((a, b) => a + (Number(b.amount) || 0), 0),
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

function localDateTime(value = new Date()) {
  const d = new Date(value);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function openExpense(item = null) {
  expenseForm.value = item
    ? { ...item, incurred_at: localDateTime(item.incurred_at), notes: item.notes || '' }
    : { id: null, title: '', category: 'supplies', amount: null, incurred_at: localDateTime(), notes: '' };
}
async function saveExpense() {
  if (savingExpense.value) return;
  savingExpense.value = true;
  try {
    const f = expenseForm.value;
    const wasEditing = Boolean(f.id);
    const payload = { title: f.title.trim(), category: f.category, amount: Number(f.amount),
      incurred_at: new Date(f.incurred_at).toISOString(), notes: f.notes || null };
    if (wasEditing) await finance.updateExpense(f.id, payload); else await finance.createExpense(payload);
    expenseForm.value = null;
    await load(finance.period);
    ui.toast(t(wasEditing ? 'exp_updated' : 'exp_created'), 'success');
  } catch { ui.toast(t('error_generic'), 'error'); } finally { savingExpense.value = false; }
}
async function removeExpense(item) {
  if (!window.confirm(t('exp_delete_q', { title: item.title }))) return;
  try {
    await finance.deleteExpense(item.id);
    await load(finance.period);
    ui.toast(t('exp_deleted'), 'success');
  } catch { ui.toast(t('error_generic'), 'error'); }
}
/** Downloads a real .xlsx for the period currently shown. */
async function onExport() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    await insights.exportExcel({ type: 'full', period: finance.period, lang: ui.locale });
    ui.toast(t('xl_done'), 'success');
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    exporting.value = false;
  }
}

onMounted(() => load('month'));

// Weekday labels come localized from the backend, so refetch on locale change.
watch(() => ui.locale, () => load(finance.period));
</script>

<style scoped>
.fin-wrap { padding: 22px 28px 40px; }
.fin-inner { width: 100%; display: flex; flex-direction: column; gap: 16px; }

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
/* Capped: at full-bleed 62% of a 1/7th column is a ~155px slab, which reads as
   a block of colour rather than a bar. */
.fin-bar { width: 62%; max-width: 64px; min-height: 6px; border-radius: 9px 9px 0 0; transition: height .3s ease; }
.fin-bar-lbl { font-size: 11.5px; color: var(--muted-3); font-weight: 700; margin-top: 8px; }

/* Breakdown */
.fin-breakdowns { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; align-items: start; }
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

.exp-add-btn {
  min-height: 48px; padding-block: 0; padding-inline: 14px 21px; gap: 10px; border-radius: 15px;
  font-size: 14px; font-weight: 800; white-space: nowrap;
  box-shadow: 0 10px 22px -12px rgba(249, 122, 83, .9);
  transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
}
.exp-add-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 26px -13px rgba(249, 122, 83, .95); filter: saturate(1.08); }
.exp-add-btn:active { transform: translateY(0); box-shadow: 0 7px 16px -11px rgba(249, 122, 83, .8); }
.exp-add-btn:focus-visible { outline: 3px solid rgba(249, 122, 83, .28); outline-offset: 3px; }
.exp-add-icon {
  width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
  flex: none; border-radius: 10px; color: #fff; background: rgba(255,255,255,.2);
  border: 1px solid rgba(255,255,255,.24);
}
.exp-actions { display:flex; gap:6px; }
.exp-icon { width:34px; height:34px; border:1px solid var(--line-3); border-radius:10px; background:var(--surface); cursor:pointer; font-size:18px; color:var(--ink); }
.exp-icon.danger { color:var(--over); }
.exp-scrim { position:fixed; inset:0; z-index:80; background:rgba(30,25,20,.46); display:grid; place-items:center; padding:18px; }
.exp-modal { width:min(520px, 100%); padding:24px; background:var(--surface); }
.exp-form { display:grid; gap:14px; }
.exp-form label { display:grid; gap:6px; font-weight:700; font-size:13px; color:var(--ink); }
.exp-form select { appearance:auto; }
.exp-notes { min-height:84px; padding-top:12px; resize:vertical; }
.exp-form-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:4px; }
/* Responsive */
@media (max-width: 900px) {
  .fin-kpis { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 720px) {
  .fin-wrap { padding: 18px 16px 40px; }
  .fin-breakdowns { grid-template-columns: 1fr; }
  .fin-head-actions { margin-inline-start: 0; width: 100%; }
  .fin-head-actions .exp-add-btn { order: -1; }
}
@media (max-width: 460px) {
  .fin-kpis { grid-template-columns: 1fr; }
  .exp-add-btn { min-height: 46px; padding-inline: 14px 18px; }
}
</style>
