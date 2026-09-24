<template>
  <div class="pub-root">
    <button class="lang-fab" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

    <header class="hero">
      <div class="hero-inner">
        <BrandLogo :size="46" :show-text="true" tone="inverse" />
        <h1 class="hero-title">{{ t('pb_title') }}</h1>
        <p class="hero-sub">{{ t('pb_sub') }}</p>
      </div>
    </header>

    <div class="pub-shell wide">
      <div v-if="loading" class="pub-center"><div class="fc-spin"></div></div>

      <!-- ---------------------------- DONE ---------------------------- -->
      <div v-else-if="done" class="pub-card pub-pad center screen-in">
        <div class="badge-ok">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 class="sec-h">{{ t('pb_done_title') }}</h1>
        <p class="sub">{{ t('pb_done_sub') }}</p>

        <div class="ref-box">
          <div class="ref-lbl">{{ t('pb_ref_label') }}</div>
          <div class="ref-val" dir="ltr">{{ done.reference }}</div>
        </div>

        <dl class="recap">
          <div><dt>{{ t('bk_date') }}</dt><dd dir="ltr">{{ fmtDateTime(done.starts_at) }}</dd></div>
          <div><dt>{{ t('bk_children') }}</dt><dd>{{ done.children_count }}</dd></div>
          <div><dt>{{ t('pb_total') }}</dt><dd>{{ done.amount }} {{ cfg.currency }}</dd></div>
        </dl>

        <p class="pay-note">💳 {{ t('pb_pay_note') }}</p>
        <button class="fc-btn fc-btn-ghost wide" type="button" @click="reset">{{ t('pb_new_booking') }}</button>
      </div>

      <div v-else-if="!kindCfg?.enabled" class="pub-card pub-pad center">
        <div class="crest">🎈</div>
        <h1 class="sec-h">{{ t('pb_closed') }}</h1>
      </div>

      <!-- ---------------------------- FORM ---------------------------- -->
      <template v-else>
        <!-- type -->
        <section class="pub-card pub-pad blk">
          <h2 class="sec-h sm">{{ t('pb_step_type') }}</h2>
          <div class="seg">
            <button
              v-for="k in offeredKinds"
              :key="k"
              type="button"
              class="seg-btn"
              :class="{ on: type === k }"
              @click="pickType(k)"
            >{{ k === 'party' ? t('bk_party') : t('bk_workshop') }}</button>
          </div>
          <p class="hint">{{ t('pb_duration') }}: {{ kindCfg.duration_minutes }} {{ t('mins') }}</p>
        </section>

        <!-- date -->
        <section class="pub-card pub-pad blk">
          <div class="cal-head">
            <button type="button" class="cal-nav" :aria-label="t('pb_month_prev')" :disabled="atFirstMonth" @click="shiftMonth(-1)">‹</button>
            <h2 class="sec-h sm nomargin">{{ monthLabel }}</h2>
            <button type="button" class="cal-nav" :aria-label="t('pb_month_next')" @click="shiftMonth(1)">›</button>
          </div>

          <div class="dow">
            <span v-for="(d, i) in dowLabels" :key="i">{{ d }}</span>
          </div>
          <div class="grid">
            <button
              v-for="(cell, i) in monthCells"
              :key="i"
              type="button"
              class="day"
              :class="{ blank: !cell, on: cell === date, past: cell && cell < todayIso }"
              :disabled="!cell || cell < todayIso"
              @click="pickDate(cell)"
            >{{ cell ? Number(cell.slice(8)) : '' }}</button>
          </div>
        </section>

        <!-- slots -->
        <section v-if="date" class="pub-card pub-pad blk">
          <h2 class="sec-h sm">{{ t('bk_pick_slot') }}</h2>
          <div v-if="slotsLoading" class="pub-center mini"><div class="fc-spin"></div></div>
          <div v-else-if="!slots.length" class="empty-line">{{ t('bk_no_slots') }}</div>
          <div v-else class="slots">
            <button
              v-for="sl in slots"
              :key="sl.slot"
              type="button"
              class="slot"
              :class="{ on: slot === sl.slot, off: !sl.available }"
              :disabled="!sl.available"
              @click="slot = sl.slot"
            >
              <span class="slot-t" dir="ltr">{{ slotLabel(sl.starts_at, sl.ends_at, ui.locale) }}</span>
              <span class="slot-s">{{ sl.available ? t('bk_available') : (sl.reason === 'taken' ? t('bk_taken') : t('bk_too_soon')) }}</span>
            </button>
          </div>
        </section>

        <!-- details -->
        <section v-if="slot" class="pub-card pub-pad blk">
          <h2 class="sec-h sm">{{ t('pb_step_details') }}</h2>

          <div class="field">
            <label class="lbl" for="pb-n">{{ t('bk_children') }}</label>
            <div class="stepper">
              <button type="button" class="step-btn" :disabled="childrenCount <= kindCfg.min_children" @click="childrenCount--">−</button>
              <input id="pb-n" v-model.number="childrenCount" class="fc-input step-in" type="number" inputmode="numeric" :min="kindCfg.min_children" :max="kindCfg.max_children" />
              <button type="button" class="step-btn" :disabled="childrenCount >= kindCfg.max_children" @click="childrenCount++">+</button>
            </div>
            <p class="hint">{{ t('pb_children_range', { min: kindCfg.min_children, max: kindCfg.max_children }) }}</p>
          </div>

          <div v-if="cfg.themes?.length" class="field">
            <label class="lbl">{{ t('bk_theme') }}</label>
            <div class="chips">
              <button
                v-for="th in cfg.themes"
                :key="th.key"
                type="button"
                class="chip"
                :class="{ on: theme === th.key }"
                @click="theme = th.key"
              >{{ th[ui.locale] || th.en }}</button>
            </div>
          </div>

          <div v-if="cfg.foods?.length" class="field">
            <label class="lbl">{{ t('bk_food') }}</label>
            <div class="chips">
              <button
                v-for="f in cfg.foods"
                :key="f.key"
                type="button"
                class="chip"
                :class="{ on: food === f.key }"
                @click="food = f.key"
              >
                {{ f[ui.locale] || f.en }}
                <small v-if="f.price_per_child"> · {{ f.price_per_child }} {{ cfg.currency }}/{{ t('pb_per_child') }}</small>
              </button>
            </div>
          </div>

          <h2 class="sec-h sm gap">{{ t('pb_your_info') }}</h2>
          <div class="field">
            <label class="lbl" for="pb-name">{{ t('bk_guardian') }}</label>
            <input id="pb-name" v-model="guardianName" class="fc-input" autocomplete="name" />
          </div>
          <div class="field">
            <label class="lbl" for="pb-ph">{{ t('bk_phone') }}</label>
            <input id="pb-ph" v-model="phone" class="fc-input" dir="ltr" inputmode="tel" placeholder="05xxxxxxxx" autocomplete="tel" />
          </div>
          <div class="field">
            <label class="lbl" for="pb-no">{{ t('bk_notes') }} <span class="opt">{{ t('optional') }}</span></label>
            <textarea id="pb-no" v-model="notes" class="pub-area" rows="3"></textarea>
          </div>
        </section>

        <!-- price + confirm -->
        <section v-if="slot" class="pub-card pub-pad blk">
          <dl class="price">
            <div><dt>{{ t('pb_price_base') }}</dt><dd>{{ priced.base }} {{ cfg.currency }}</dd></div>
            <div><dt>{{ t('pb_price_children') }}</dt><dd>{{ priced.per_child_total }} {{ cfg.currency }}</dd></div>
            <div v-if="priced.catering_total"><dt>{{ t('pb_price_food') }}</dt><dd>{{ priced.catering_total }} {{ cfg.currency }}</dd></div>
            <div class="total"><dt>{{ t('pb_total') }}</dt><dd>{{ priced.total }} {{ cfg.currency }}</dd></div>
          </dl>
          <p class="pay-note">💳 {{ t('pb_pay_note') }}</p>

          <button type="button" class="consent" :aria-pressed="consent" @click="consent = !consent">
            <span class="cbox" :class="{ on: consent }">
              <svg v-if="consent" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <span class="consent-txt">
              {{ t('pb_consent') }}
              <a v-if="termsHref" :href="termsHref" target="_blank" rel="noopener noreferrer" class="terms-a" @click.stop>{{ t('rg_terms_link') }}</a>
            </span>
          </button>

          <button class="fc-btn fc-btn-primary wide" type="button" :disabled="!canSubmit || submitting" @click="submit">
            <span v-if="submitting" class="fc-spin small"></span>
            <span v-else>{{ t('pb_submit') }}</span>
          </button>
        </section>
      </template>

      <div class="pub-foot">{{ cfg?.center_name || t('brand') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BrandLogo from '@/components/BrandLogo.vue';
import { useBookingsStore } from '@/stores/bookings.js';
import { useUiStore } from '@/stores/ui.js';
import { slotLabel } from '@/lib/time.js';

const { t } = useI18n();
const ui = useUiStore();
const store = useBookingsStore();

const loading = ref(true);
const submitting = ref(false);
const slotsLoading = ref(false);
const done = ref(null);

const cfg = ref({});
// The centre's own /terms page when written in Settings, else its external link.
const termsHref = computed(() => (cfg.value?.has_terms ? '/terms' : cfg.value?.terms_url || ''));
const type = ref('party');
const date = ref('');
const slot = ref('');
const slots = ref([]);
const childrenCount = ref(10);
const theme = ref('');
const food = ref('');
const guardianName = ref('');
const phone = ref('');
const notes = ref('');
const consent = ref(false);

const kindCfg = computed(() => cfg.value?.[type.value] || null);
const offeredKinds = computed(() => ['party', 'workshop'].filter((k) => cfg.value?.[k]?.enabled));

// ---- Riyadh-local "today", so a late-night visitor doesn't see today greyed out
const RIYADH = 'Asia/Riyadh';
function isoInRiyadh(d = new Date()) {
  // en-CA gives YYYY-MM-DD, which is exactly the format the API wants.
  return d.toLocaleDateString('en-CA', { timeZone: RIYADH });
}
const todayIso = ref(isoInRiyadh());

// ---- month grid
const cursor = ref(new Date());
const monthLabel = computed(() => cursor.value.toLocaleDateString(
  ui.locale === 'ar' ? 'ar-SA' : 'en-GB', { month: 'long', year: 'numeric' },
));
const dowLabels = computed(() => (ui.locale === 'ar'
  ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
  : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']));

const atFirstMonth = computed(() => {
  const now = new Date();
  return cursor.value.getFullYear() === now.getFullYear() && cursor.value.getMonth() === now.getMonth();
});

/** Leading blanks + every day of the visible month as YYYY-MM-DD. */
const monthCells = computed(() => {
  const y = cursor.value.getFullYear();
  const m = cursor.value.getMonth();
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = Array.from({ length: first.getDay() }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
});

function shiftMonth(delta) {
  const next = new Date(cursor.value);
  next.setDate(1);
  next.setMonth(next.getMonth() + delta);
  cursor.value = next;
}

// ---- price, computed locally from the same rules the server re-checks on save
const priced = computed(() => {
  const c = kindCfg.value;
  if (!c) return { base: 0, per_child_total: 0, catering_total: 0, total: 0 };
  const n = Number(childrenCount.value) || 0;
  const f = (cfg.value.foods || []).find((x) => x.key === food.value);
  const base = Number(c.base_price) || 0;
  const per = (Number(c.price_per_child) || 0) * n;
  const cat = (Number(f?.price_per_child) || 0) * n;
  return { base, per_child_total: per, catering_total: cat, total: base + per + cat };
});

const canSubmit = computed(() =>
  Boolean(date.value && slot.value && consent.value)
  && guardianName.value.trim().length >= 2
  && phone.value.trim().length >= 6
  && childrenCount.value >= (kindCfg.value?.min_children || 1)
  && childrenCount.value <= (kindCfg.value?.max_children || 999));

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString(ui.locale === 'ar' ? 'ar-SA' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: RIYADH,
  });
}

async function loadSlots() {
  if (!date.value) return;
  slotsLoading.value = true;
  slot.value = '';
  try {
    const data = await store.availability(type.value, date.value, { pub: true });
    slots.value = data.slots || [];
  } catch {
    slots.value = [];
  } finally {
    slotsLoading.value = false;
  }
}

function pickDate(iso) {
  if (!iso) return;
  date.value = iso;
  loadSlots();
}

function pickType(k) {
  type.value = k;
  childrenCount.value = cfg.value[k]?.min_children || 1;
  if (date.value) loadSlots();
}

watch(type, () => { slot.value = ''; });

function reset() {
  done.value = null;
  date.value = '';
  slot.value = '';
  slots.value = [];
  theme.value = '';
  food.value = '';
  notes.value = '';
  consent.value = false;
  guardianName.value = '';
  phone.value = '';
}

async function submit() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    done.value = await store.publicCreate({
      type: type.value,
      guardian_name: guardianName.value.trim(),
      phone: phone.value.trim(),
      date: date.value,
      slot: slot.value,
      children_count: childrenCount.value,
      theme: theme.value || null,
      food: food.value || null,
      notes: notes.value.trim() || null,
      consent: true,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    const status = err?.response?.status;
    ui.toast(status === 409 ? t('bk_conflict') : t('error_generic'), 'error');
    if (status === 409) loadSlots(); // someone beat her to it — refresh the grid
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    cfg.value = await store.publicConfig();
    const first = offeredKinds.value[0];
    if (first) {
      type.value = first;
      childrenCount.value = cfg.value[first]?.min_children || 1;
    }
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.hero {
  padding: 40px 20px 46px;
  background: linear-gradient(140deg, var(--brand) 0%, #F58C4E 52%, var(--brand-2) 100%);
  color: #fff; text-align: center;
}
.hero-inner { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.hero-title { font-family: var(--font-head); font-weight: 800; font-size: clamp(22px, 5.4vw, 32px); margin: 4px 0 0; }
.hero-sub { font-size: 14.5px; margin: 0; opacity: .95; max-width: 46ch; line-height: 1.6; }

.pub-shell { padding-top: 20px; }
.blk { margin-bottom: 14px; }
.sec-h { font-family: var(--font-head); font-weight: 800; font-size: 20px; color: var(--ink); margin: 12px 0 0; }
.sec-h.sm { font-size: 16px; margin: 0 0 14px; }
.sec-h.gap { margin-top: 22px; }
.nomargin { margin: 0; }
.sub { font-size: 14.5px; color: var(--muted-2); margin: 8px 0 0; }
.hint { font-size: 12.5px; color: var(--muted-3); margin: 8px 0 0; }
.opt { background: var(--line-soft); color: var(--muted-3); font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.crest { font-size: 44px; text-align: center; }

/* segmented control */
.seg { display: flex; gap: 8px; }
.seg-btn {
  flex: 1; height: 50px; border: 2px solid var(--line-3); border-radius: 14px;
  background: #fff; color: var(--muted-strong); font-family: var(--font-body);
  font-weight: 700; font-size: 15px; cursor: pointer; transition: all .15s ease;
}
.seg-btn.on { border-color: var(--brand); background: #FFF3ED; color: var(--accent); }

/* calendar */
.cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 8px; }
.cal-nav {
  width: 44px; height: 44px; flex: none; border-radius: 12px;
  border: 2px solid var(--line-3); background: #fff; cursor: pointer;
  font-size: 22px; line-height: 1; color: var(--muted-strong);
}
.cal-nav:disabled { opacity: .35; cursor: not-allowed; }
.dow, .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.dow { margin-bottom: 6px; }
.dow span { text-align: center; font-size: 11px; font-weight: 700; color: var(--muted-3); }
.day {
  aspect-ratio: 1; min-height: 40px;
  border: 2px solid var(--line-2); border-radius: 12px; background: #fff;
  font-family: var(--font-body); font-weight: 700; font-size: 14px; color: var(--ink);
  cursor: pointer; transition: all .12s ease;
}
.day:hover:not(:disabled) { border-color: var(--brand); }
.day.on { background: var(--brand); border-color: var(--brand); color: #fff; }
.day.blank { border: none; background: none; cursor: default; }
.day.past { color: var(--line-3); border-color: var(--line-soft); cursor: not-allowed; }

/* slots */
.slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.slot {
  padding: 12px 10px; border: 2px solid var(--line-3); border-radius: 14px;
  background: #fff; cursor: pointer; display: flex; flex-direction: column; gap: 3px;
  font-family: var(--font-body); transition: all .15s ease;
}
.slot-t { font-family: var(--font-head); font-weight: 800; font-size: 19px; color: var(--ink); }
.slot-s { font-size: 11.5px; color: var(--play); font-weight: 700; }
.slot.on { border-color: var(--play); background: #EAF7F4; }
.slot.off { opacity: .5; cursor: not-allowed; background: var(--chip); }
.slot.off .slot-s { color: var(--muted-3); }
.empty-line { text-align: center; color: var(--muted-2); font-size: 14px; padding: 18px 0; }
.pub-center.mini { min-height: 90px; }

/* fields */
.field { margin-bottom: 16px; }
.lbl { display: block; font-size: 13px; font-weight: 700; color: var(--muted-strong); margin-bottom: 7px; }
.stepper { display: flex; gap: 8px; align-items: center; }
.step-btn {
  width: 52px; height: 52px; flex: none; border-radius: 14px;
  border: 2px solid var(--line-3); background: #fff; cursor: pointer;
  font-size: 24px; line-height: 1; color: var(--accent); font-weight: 700;
}
.step-btn:disabled { opacity: .35; cursor: not-allowed; }
.step-in { text-align: center; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  padding: 10px 14px; min-height: 44px;
  border: 2px solid var(--line-3); border-radius: 999px; background: #fff;
  font-family: var(--font-body); font-weight: 700; font-size: 14px; color: var(--muted-strong);
  cursor: pointer; transition: all .15s ease;
}
.chip small { font-weight: 600; color: var(--muted-3); }
.chip.on { border-color: var(--brand); background: #FFF3ED; color: var(--accent); }
.chip.on small { color: var(--accent); }

/* price */
.price, .recap { margin: 0; }
.price div, .recap div { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line-soft); }
.price dt, .recap dt { color: var(--muted-2); font-size: 14px; }
.price dd, .recap dd { margin: 0; font-weight: 700; color: var(--ink); font-size: 14.5px; }
.price .total { border-bottom: none; padding-top: 14px; }
.price .total dt { font-weight: 800; color: var(--ink); font-size: 16px; }
.price .total dd { font-family: var(--font-head); font-size: 22px; color: var(--accent); }
.pay-note { font-size: 13px; color: var(--muted-2); text-align: center; margin: 14px 0 0; background: var(--chip); padding: 10px; border-radius: 12px; }

.consent { display: flex; align-items: flex-start; gap: 11px; width: 100%; text-align: start; background: none; border: none; cursor: pointer; padding: 0; margin-top: 18px; }
.cbox { width: 26px; height: 26px; flex: none; border-radius: 8px; border: 2px solid var(--line-3); background: #fff; display: flex; align-items: center; justify-content: center; transition: all .15s ease; }
.cbox.on { background: var(--brand); border-color: var(--brand); }
.consent-txt { font-size: 13.5px; color: var(--muted-strong); line-height: 1.55; }
.terms-a { color: var(--accent); font-weight: 700; text-decoration: underline; margin-inline-start: 4px; }

.ref-box { margin-top: 20px; background: var(--chip); border-radius: 16px; padding: 16px; }
.ref-lbl { font-size: 12.5px; color: var(--muted-2); }
.ref-val { font-family: var(--font-head); font-weight: 800; font-size: 26px; color: var(--accent); letter-spacing: 2px; }
.recap { margin-top: 18px; text-align: start; }

.wide { width: 100%; height: 54px; margin-top: 18px; font-size: 16px; }
.fc-spin.small { width: 22px; height: 22px; border-width: 3px; }

@media (max-width: 620px) {
  .hero { padding: 32px 16px 38px; }
  .day { min-height: 38px; font-size: 13px; }
  .slots { grid-template-columns: 1fr 1fr; }
}
</style>
