<template>
  <div class="screen-in wrap">
    <header class="head">
      <div>
        <h1 class="h1">{{ t('in_title') }}</h1>
        <p class="sub">{{ t('in_sub') }}</p>
      </div>
      <div class="head-acts">
        <div class="tabs" role="tablist">
          <button
            v-for="p in PERIODS"
            :key="p.key"
            type="button"
            class="tab"
            :class="{ on: store.period === p.key }"
            @click="load(p.key)"
          >{{ t(p.label) }}</button>
        </div>
        <div class="xl">
          <select v-model="reportType" class="fc-input xl-sel" :aria-label="t('xl_pick')">
            <option value="full">{{ t('xl_full') }}</option>
            <option value="sessions">{{ t('xl_sessions') }}</option>
            <option value="customers">{{ t('xl_customers') }}</option>
            <option value="bookings">{{ t('xl_bookings') }}</option>
            <option value="expenses">{{ t('xl_expenses') }}</option>
            <option value="reviews">{{ t('xl_reviews') }}</option>
          </select>
          <button type="button" class="fc-btn fc-btn-ghost xl-btn" :disabled="exporting" @click="doExport">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2.2" aria-hidden="true"><path d="M12 3v12M8 11l4 4 4-4M4 21h16" /></svg>
            {{ exporting ? t('xl_exporting') : t('xl_export') }}
          </button>
        </div>
      </div>
    </header>

    <div v-if="loading && !d" class="loading"><span class="fc-spin"></span><span>{{ t('loading') }}</span></div>

    <template v-else-if="d">
      <!-- Headline answers. These are single facts, so they are stat tiles, not charts. -->
      <div class="hero-row">
        <div class="fc-card hero-tile">
          <div class="hero-lbl">{{ t('in_busiest_day') }}</div>
          <div class="hero-val">{{ d.busiest_day.count ? d.busiest_day.label : '—' }}</div>
          <div class="hero-note">{{ d.busiest_day.count }} {{ t('in_visits') }} · {{ periodLabel }}</div>
        </div>
        <div class="fc-card hero-tile">
          <div class="hero-lbl">{{ t('in_busiest_hour') }}</div>
          <div class="hero-val" dir="ltr">{{ d.busiest_hour.count ? hourLabel(d.busiest_hour.hour) : '—' }}</div>
          <div class="hero-note">{{ d.busiest_hour.count }} {{ t('in_visits') }} · {{ periodLabel }}</div>
        </div>
        <div class="fc-card hero-tile accent">
          <div class="hero-lbl">{{ t('in_growth') }}</div>
          <div class="hero-val" dir="ltr">
            {{ d.trend.growth_pct === null ? '—' : `${d.trend.growth_pct > 0 ? '+' : ''}${d.trend.growth_pct}%` }}
          </div>
          <div class="hero-note">{{ t('in_trend') }}</div>
        </div>
      </div>

      <!-- KPI strip -->
      <div class="kpis">
        <div v-for="k in kpiTiles" :key="k.label" class="fc-card kpi">
          <div class="kpi-lbl">{{ t(k.label) }}</div>
          <div class="kpi-val" dir="ltr">{{ k.value }}</div>
        </div>
      </div>

      <div class="cols">
        <!-- Busiest days. Single series => one hue, no legend; the peak is labelled. -->
        <section class="fc-card card">
          <h2 class="card-t">{{ t('in_by_weekday') }}</h2>
          <div v-if="!maxWeekday" class="nodata">{{ t('in_no_data') }}</div>
          <div v-else class="vbars">
            <div v-for="w in d.by_weekday" :key="w.weekday" class="vcol">
              <div class="vtrack">
                <span v-if="w.count" class="vval">{{ w.count }}</span>
                <div
                  class="vbar"
                  :class="{ peak: w.count === maxWeekday && w.count > 0 }"
                  :style="{ height: `${pct(w.count, maxWeekday)}%` }"
                  :title="`${w.label} · ${w.count}`"
                ></div>
              </div>
              <div class="vlbl">{{ shortDay(w.label) }}</div>
            </div>
          </div>
        </section>

        <!-- Busiest hours. Labels only on the peak — a number on every bar is noise. -->
        <section class="fc-card card">
          <h2 class="card-t">{{ t('in_by_hour') }}</h2>
          <div v-if="!maxHour" class="nodata">{{ t('in_no_data') }}</div>
          <div v-else class="vbars hours">
            <div v-for="h in openHours" :key="h.hour" class="vcol">
              <div class="vtrack">
                <div
                  class="vbar"
                  :class="{ peak: h.count === maxHour && h.count > 0 }"
                  :style="{ height: `${pct(h.count, maxHour)}%` }"
                  :title="`${hourLabel(h.hour)} · ${h.count}`"
                ></div>
              </div>
              <div class="vlbl tiny" dir="ltr">{{ h.hour }}</div>
            </div>
          </div>
        </section>
      </div>

      <div class="cols">
        <!-- Income sources: 3 categories, every value directly labelled (the brand
             hues sit under 3:1 against the surface, so labels are required). -->
        <section class="fc-card card">
          <h2 class="card-t">{{ t('in_income_sources') }}</h2>
          <div v-for="s in d.income_sources" :key="s.key" class="row">
            <div class="row-top">
              <span class="row-lbl"><span class="dot" :style="{ background: s.color }"></span>{{ t(`in_src_${s.key}`) }}</span>
              <span class="row-val" dir="ltr">{{ fmtMoney(s.amount) }} <span class="row-pct">· {{ pct(s.amount, totalIncome) }}%</span></span>
            </div>
            <div class="track"><div class="fill" :style="{ width: `${pct(s.amount, totalIncome)}%`, background: s.color }"></div></div>
          </div>
        </section>

        <!-- Monthly revenue trend -->
        <section class="fc-card card">
          <h2 class="card-t">{{ t('in_trend') }}</h2>
          <div v-if="!maxTrend" class="nodata">{{ t('in_no_data') }}</div>
          <div v-else class="vbars">
            <div v-for="m in d.trend.series" :key="m.month" class="vcol">
              <div class="vtrack">
                <div class="vbar trend" :style="{ height: `${pct(m.revenue, maxTrend)}%` }" :title="`${m.month} · ${fmtMoney(m.revenue)}`"></div>
              </div>
              <div class="vlbl tiny" dir="ltr">{{ m.month.slice(5) }}</div>
            </div>
          </div>
        </section>
      </div>

      <div class="cols">
        <!-- Duration mix -->
        <section class="fc-card card">
          <h2 class="card-t">{{ t('in_duration_mix') }}</h2>
          <div v-if="!maxDuration" class="nodata">{{ t('in_no_data') }}</div>
          <template v-else>
            <div v-for="m in d.duration_mix" :key="m.minutes" class="row">
              <div class="row-top">
                <span class="row-lbl">{{ m.minutes }} {{ t('mins') }}</span>
                <span class="row-val" dir="ltr">{{ m.count }}</span>
              </div>
              <div class="track"><div class="fill" :style="{ width: `${pct(m.count, maxDuration)}%`, background: 'var(--brand)' }"></div></div>
            </div>
          </template>
        </section>

        <!-- Children: split + age bands -->
        <section class="fc-card card">
          <h2 class="card-t">{{ t('in_gender') }}</h2>
          <div class="split">
            <div class="split-part">
              <span class="dot" style="background:#3E97D8"></span>
              <span class="split-lbl">{{ t('boy') }}</span>
              <span class="split-val" dir="ltr">{{ d.gender_mix.m }}</span>
            </div>
            <div class="split-part">
              <span class="dot" style="background:#EC6A9C"></span>
              <span class="split-lbl">{{ t('girl') }}</span>
              <span class="split-val" dir="ltr">{{ d.gender_mix.f }}</span>
            </div>
          </div>

          <h2 class="card-t gap">{{ t('in_ages') }}</h2>
          <div v-if="!maxAge" class="nodata">{{ t('in_no_data') }}</div>
          <template v-else>
            <div v-for="b in d.age_bands" :key="b.from" class="row">
              <div class="row-top">
                <span class="row-lbl">{{ t('in_yrs_band', { from: b.from, to: b.to }) }}</span>
                <span class="row-val" dir="ltr">{{ b.count }}</span>
              </div>
              <div class="track"><div class="fill" :style="{ width: `${pct(b.count, maxAge)}%`, background: '#7C5CE0' }"></div></div>
            </div>
          </template>
        </section>
      </div>

      <!-- Reviews -->
      <section v-if="rv" class="fc-card card">
        <h2 class="card-t">{{ t('rv_summary') }}</h2>
        <div v-if="!rv.answered" class="nodata">{{ t('rv_none') }}</div>
        <template v-else>
          <div class="rv-top">
            <div class="rv-avg">
              <div class="rv-num" dir="ltr">{{ rv.average }}</div>
              <div class="rv-stars" :aria-label="`${rv.average}/5`">
                <span v-for="n in 5" :key="n" class="star" :class="{ on: n <= Math.round(rv.average) }">★</span>
              </div>
              <div class="rv-lbl">{{ t('rv_average') }}</div>
            </div>
            <div class="rv-dist">
              <div v-for="s in [...rv.distribution].reverse()" :key="s.star" class="rv-line">
                <span class="rv-s" dir="ltr">{{ s.star }}★</span>
                <div class="track slim"><div class="fill" :style="{ width: `${pct(s.count, rv.answered)}%`, background: 'var(--brand-2)' }"></div></div>
                <span class="rv-c" dir="ltr">{{ s.count }}</span>
              </div>
            </div>
            <div class="rv-meta">
              <div><span class="rv-k">{{ t('rv_responses') }}</span><span class="rv-v" dir="ltr">{{ rv.answered }}</span></div>
              <div><span class="rv-k">{{ t('rv_rate') }}</span><span class="rv-v" dir="ltr">{{ rv.response_rate }}%</span></div>
            </div>
          </div>

          <template v-if="rv.comments?.length">
            <h3 class="card-t gap sm">{{ t('rv_recent') }}</h3>
            <ul class="comments">
              <li v-for="(c, i) in rv.comments" :key="i" class="comment">
                <span class="c-rate" dir="ltr">{{ c.rating }}★</span>
                <span class="c-txt">{{ c.comment }}</span>
              </li>
            </ul>
          </template>
        </template>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useInsightsStore } from '@/stores/insights.js';
import { useUiStore } from '@/stores/ui.js';

const { t } = useI18n();
const store = useInsightsStore();
const ui = useUiStore();

const PERIODS = [
  { key: 'today', label: 'fin_today' },
  { key: 'week', label: 'fin_week' },
  { key: 'month', label: 'fin_month' },
];

const loading = ref(true);
const exporting = ref(false);
const reportType = ref('full');

const d = computed(() => store.data);
const rv = computed(() => store.reviews);
const periodLabel = computed(() => t(PERIODS.find((p) => p.key === store.period)?.label || 'fin_month'));

const pct = (v, max) => (max > 0 ? Math.round((Number(v) / max) * 100) : 0);
const fmtMoney = (v) => `${Number(v || 0).toLocaleString('en-US')} ${d.value?.currency || ''}`;
const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;
const shortDay = (label) => (label.length > 6 ? label.slice(0, 5) : label);

const maxWeekday = computed(() => Math.max(0, ...(d.value?.by_weekday || []).map((w) => w.count)));
const maxHour = computed(() => Math.max(0, ...(d.value?.by_hour || []).map((h) => h.count)));
const maxTrend = computed(() => Math.max(0, ...(d.value?.trend.series || []).map((m) => m.revenue)));
const maxDuration = computed(() => Math.max(0, ...(d.value?.duration_mix || []).map((m) => m.count)));
const maxAge = computed(() => Math.max(0, ...(d.value?.age_bands || []).map((b) => b.count)));
const totalIncome = computed(() => (d.value?.income_sources || []).reduce((s, x) => s + x.amount, 0));

/**
 * A 24-bar chart is unreadable on a phone and most of it is the centre being
 * closed. Show the span that actually has traffic, padded by an hour each side.
 */
const openHours = computed(() => {
  const hours = d.value?.by_hour || [];
  const active = hours.filter((h) => h.count > 0).map((h) => h.hour);
  if (!active.length) return hours;
  const lo = Math.max(0, Math.min(...active) - 1);
  const hi = Math.min(23, Math.max(...active) + 1);
  return hours.slice(lo, hi + 1);
});

const kpiTiles = computed(() => {
  const k = d.value?.kpis || {};
  return [
    { label: 'fin_sessions', value: k.sessions ?? 0 },
    { label: 'in_avg_duration', value: `${k.avg_duration_minutes ?? 0}′` },
    { label: 'in_new_customers', value: k.new_customers ?? 0 },
    { label: 'in_repeat', value: `${k.repeat_rate_pct ?? 0}%` },
    { label: 'in_children_total', value: k.children_total ?? 0 },
    { label: 'in_allergy', value: k.children_with_allergy ?? 0 },
  ];
});

async function load(period = store.period) {
  loading.value = true;
  try {
    await store.fetch(period, ui.locale);
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    loading.value = false;
  }
}

async function doExport() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    await store.exportExcel({ type: reportType.value, period: store.period, lang: ui.locale });
    ui.toast(t('xl_done'), 'success');
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    exporting.value = false;
  }
}

onMounted(() => load());
</script>

<style scoped>
.wrap { width: 100%; padding: 26px 28px 48px; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.h1 { font-family: var(--font-head); font-weight: 800; font-size: clamp(22px, 3vw, 28px); color: var(--ink); margin: 0; }
.sub { color: var(--muted-2); font-size: 14.5px; margin: 6px 0 0; }
.head-acts { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

.tabs { display: flex; gap: 4px; background: #fff; border: 2px solid var(--line-3); border-radius: 14px; padding: 4px; }
.tab {
  height: 38px; padding: 0 15px; border: none; border-radius: 10px; cursor: pointer;
  background: transparent; color: var(--muted-strong);
  font-family: var(--font-body); font-weight: 700; font-size: 14px;
}
.tab.on { background: var(--ink); color: #fff; }
.xl { display: flex; gap: 8px; }
.xl-sel { width: auto; min-width: 150px; height: 46px; }
.xl-btn { height: 46px; padding: 0 16px; }

.loading { display: flex; align-items: center; gap: 12px; color: var(--muted-2); padding: 50px 0; justify-content: center; }

/* headline tiles */
.hero-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 14px; }
.hero-tile { padding: 20px; }
.hero-tile.accent { background: linear-gradient(140deg, var(--brand) 0%, var(--brand-2) 100%); border-color: transparent; color: #fff; }
.hero-lbl { font-size: 13px; font-weight: 700; color: var(--muted-2); }
.hero-tile.accent .hero-lbl { color: rgba(255,255,255,.9); }
.hero-val { font-family: var(--font-head); font-weight: 800; font-size: clamp(26px, 4vw, 34px); color: var(--ink); margin-top: 6px; line-height: 1.15; }
.hero-tile.accent .hero-val { color: #fff; }
.hero-note { font-size: 12px; color: var(--muted-3); margin-top: 4px; }
.hero-tile.accent .hero-note { color: rgba(255,255,255,.85); }

.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 14px; }
.kpi { padding: 16px; }
.kpi-lbl { font-size: 12.5px; color: var(--muted-2); font-weight: 700; }
.kpi-val { font-family: var(--font-head); font-weight: 800; font-size: 24px; color: var(--ink); margin-top: 4px; }

/* `align-items: start` so a short card ends where its content ends instead of
   stretching to match a tall neighbour and showing a pane of empty white. */
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; align-items: start; }
.card { padding: 20px; }
.card-t { font-family: var(--font-head); font-weight: 800; font-size: 16px; color: var(--ink); margin: 0 0 16px; }
.card-t.gap { margin-top: 24px; }
.card-t.sm { font-size: 14.5px; }
.nodata { color: var(--muted-3); font-size: 13.5px; text-align: center; padding: 26px 0; }

/* vertical bars: thin marks, rounded data-end, 2px surface gap, recessive baseline */
.vbars { display: flex; align-items: flex-end; gap: 2px; height: 168px; border-bottom: 1px solid var(--line-2); }
.vbars.hours { gap: 2px; }
.vcol { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; height: 100%; }
.vtrack { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; position: relative; padding: 0 1px; }
.vbar {
  /* Scales with the card: at full-bleed a 34px cap left 7 bars marooned in a
     900px panel. Still capped so a 2-bar chart doesn't become two slabs. */
  width: 100%; max-width: 64px; min-height: 3px;
  background: #F6C6AE; border-radius: 4px 4px 0 0;
  transition: height .3s ease;
}
.vbar.peak { background: var(--brand); }
.vbar.trend { background: var(--play); }
.vval { position: absolute; top: -2px; font-size: 10.5px; font-weight: 800; color: var(--muted-strong); }
.vlbl { font-size: 11.5px; color: var(--muted-3); margin-top: 7px; font-weight: 700; white-space: nowrap; }
.vlbl.tiny { font-size: 10px; }

/* horizontal rows */
.row { margin-bottom: 14px; }
.row-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 6px; }
.row-lbl { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--muted-strong); font-weight: 700; }
.row-val { font-size: 13.5px; font-weight: 800; color: var(--ink); white-space: nowrap; }
.row-pct { color: var(--muted-3); font-weight: 700; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.track { height: 9px; background: var(--line-soft); border-radius: 999px; overflow: hidden; }
.track.slim { height: 7px; flex: 1; }
.fill { height: 100%; border-radius: 999px; transition: width .3s ease; }

.split { display: flex; gap: 12px; flex-wrap: wrap; }
.split-part { display: flex; align-items: center; gap: 8px; background: var(--chip); border-radius: 12px; padding: 10px 14px; flex: 1; min-width: 120px; }
.split-lbl { font-size: 13px; color: var(--muted-strong); font-weight: 700; }
.split-val { margin-inline-start: auto; font-family: var(--font-head); font-weight: 800; font-size: 18px; color: var(--ink); }

/* reviews */
.rv-top { display: grid; grid-template-columns: auto 1fr auto; gap: 22px; align-items: center; }
.rv-avg { text-align: center; }
.rv-num { font-family: var(--font-head); font-weight: 800; font-size: 40px; color: var(--brand-2); line-height: 1; }
.rv-stars { font-size: 15px; letter-spacing: 1px; margin-top: 4px; }
.star { color: var(--line-3); }
.star.on { color: var(--brand-2); }
.rv-lbl { font-size: 12px; color: var(--muted-3); margin-top: 3px; }
.rv-dist { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.rv-line { display: flex; align-items: center; gap: 8px; }
.rv-s, .rv-c { font-size: 11.5px; color: var(--muted-3); font-weight: 700; width: 26px; flex: none; }
.rv-c { text-align: end; }
.rv-meta { display: flex; flex-direction: column; gap: 10px; }
.rv-meta div { display: flex; flex-direction: column; align-items: flex-end; }
.rv-k { font-size: 11.5px; color: var(--muted-3); }
.rv-v { font-family: var(--font-head); font-weight: 800; font-size: 19px; color: var(--ink); }
.comments { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.comment { display: flex; gap: 10px; background: var(--chip); border-radius: 12px; padding: 10px 13px; }
.c-rate { flex: none; font-weight: 800; font-size: 12.5px; color: var(--brand-2); }
.c-txt { font-size: 13.5px; color: var(--muted-strong); line-height: 1.5; overflow-wrap: anywhere; }

@media (max-width: 900px) {
  .cols { grid-template-columns: 1fr; }
  .rv-top { grid-template-columns: 1fr; gap: 16px; }
  .rv-meta { flex-direction: row; justify-content: space-around; }
  .rv-meta div { align-items: center; }
}
@media (max-width: 860px) {
  .wrap { padding: 20px 14px 40px; }
  .head-acts { width: 100%; }
  .tabs, .xl { width: 100%; }
  .tab { flex: 1; }
  .xl-sel { flex: 1; min-width: 0; }
  .vbars { height: 140px; }
}
</style>
