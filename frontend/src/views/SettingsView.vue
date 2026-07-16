<template>
  <div class="settings-view screen-in">
    <template v-if="form">
      <div class="wrap">
        <div class="page-head">
          <h1 class="page-title">{{ t('se_title') }}</h1>
        </div>

        <!-- 1) Durations & prices (+ late rate) -->
        <section class="fc-card sec">
          <div class="sec-head">
            <span class="sec-icon" style="background:#FCE1D4;">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#E85D3D" stroke-width="2.1">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
            </span>
            <div class="sec-title">{{ t('se_durations') }}</div>
          </div>
          <div class="sec-hint">{{ t('se_durations_hint') }}</div>

          <div class="dur-list">
            <div v-for="d in form.durations" :key="d.min" class="dur-row">
              <div class="dur-label">{{ durationLabel(d.min) }}</div>
              <div class="num-field" dir="ltr">
                <input class="num-input" type="number" min="0" v-model="d.price" />
                <span class="num-suffix">{{ t('se_riyal') }}</span>
              </div>
            </div>
          </div>

          <div class="late-row">
            <div>
              <div class="late-title">{{ t('se_late_rate') }}</div>
              <div class="late-sub">{{ t('se_per_min') }}</div>
            </div>
            <div class="num-field" dir="ltr">
              <input class="num-input" type="number" step="0.5" min="0" v-model="form.late_fee_per_minute" />
              <span class="num-suffix">{{ t('se_riyal') }}</span>
            </div>
          </div>
        </section>

        <!-- 2) Registration poster -->
        <section class="fc-card sec">
          <div class="sec-head">
            <span class="sec-icon" style="background:#DCF0EC;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2.1">
                <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M20 14v3M17 20h3v-3M14 20h.01" />
              </svg>
            </span>
            <div class="sec-title">{{ t('se_qr_title') }}</div>
          </div>
          <div class="sec-hint">{{ t('se_qr_hint') }}</div>

          <div class="qr-row">
            <div class="qr-box">
              <img v-if="regQr" :src="regQr" alt="" width="140" height="140" />
              <span v-else class="fc-spin"></span>
            </div>
            <div class="qr-meta">
              <div class="qr-url-lbl">{{ t('se_qr_url') }}</div>
              <div class="qr-url" dir="ltr">{{ registerUrl }}</div>
              <p v-if="urlIsLocal" class="qr-warn" role="note">{{ t('se_qr_warn') }}</p>
              <button class="fc-btn fc-btn-ghost qr-print" type="button" :disabled="!regQr" @click="printPoster">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" aria-hidden="true">
                  <path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z" />
                </svg>
                {{ t('se_qr_print') }}
              </button>
            </div>
          </div>
        </section>

        <!-- 3) WhatsApp templates -->
        <section class="fc-card sec">
          <div class="sec-head">
            <span class="sec-icon" style="background:#EDE6F7;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C5CE0" stroke-width="2.1">
                <path d="M4 4h16v12H5.2L4 17.5z" />
              </svg>
            </span>
            <div class="sec-title">{{ t('se_whatsapp') }}</div>
            <span class="sec-note">· {{ t('se_wa_hint') }}</span>
          </div>

          <div v-for="g in waGroups" :key="g.key" class="wa-group">
            <label class="wa-label">{{ t(g.labelKey) }}</label>
            <div class="wa-fields">
              <div class="wa-field">
                <span class="wa-lang">عربي</span>
                <textarea class="wa-textarea" dir="rtl" v-model="form.wa_templates[g.key].ar"></textarea>
              </div>
              <div class="wa-field">
                <span class="wa-lang">English</span>
                <textarea class="wa-textarea" dir="ltr" v-model="form.wa_templates[g.key].en"></textarea>
              </div>
            </div>
            <div class="wa-vars">
              <span class="wa-vars-label">{{ t('se_vars') }}</span>
              <span v-for="v in g.vars" :key="v" class="wa-chip" dir="ltr">{{ v }}</span>
            </div>
          </div>
        </section>

        <!-- 4) Branding -->
        <section class="fc-card sec">
          <div class="sec-head">
            <span class="sec-icon" style="background:#DCF0EC;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2.1"
                stroke-linejoin="round">
                <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z" />
              </svg>
            </span>
            <div class="sec-title">{{ t('se_branding') }}</div>
          </div>

          <label class="field-label first">{{ t('se_center_name') }}</label>
          <input class="fc-input" v-model="form.center_name" />

          <label class="field-label">{{ t('se_tagline') }}</label>
          <input class="fc-input" v-model="form.tagline" />

          <label class="field-label">{{ t('se_color') }}</label>
          <div class="swatch-row">
            <button
              v-for="c in colors"
              :key="c"
              type="button"
              class="swatch"
              :class="{ sel: form.primary_color === c }"
              :style="{ background: c }"
              :aria-label="c"
              @click="form.primary_color = c"
            ></button>
          </div>
        </section>
      </div>

      <!-- Sticky footer -->
      <div class="save-bar">
        <div class="save-inner">
          <span v-if="!canSave" class="save-note">{{ t('se_only_manager') }}</span>
          <button
            class="fc-btn fc-btn-primary save-btn"
            :disabled="!canSave || saving"
            @click="save"
          >
            <span v-if="saving" class="fc-spin small"></span>
            <template v-else>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <path d="M17 21v-8H7v8M7 3v5h8" />
              </svg>
              {{ t('se_save') }}
            </template>
          </button>
        </div>
      </div>

      <!-- Print-only: the A4 sheet that goes on the wall at the entrance. -->
      <div class="poster">
        <BrandLogo :size="72" :show-text="true" />

        <h2 class="poster-title">{{ t('poster_title') }}</h2>
        <p class="poster-sub">{{ t('poster_sub') }}</p>

        <div class="poster-qr">
          <img v-if="regQr" :src="regQr" alt="" />
        </div>

        <ol class="poster-steps">
          <li><span class="ps-n" dir="ltr">1</span>{{ t('poster_step1') }}</li>
          <li><span class="ps-n" dir="ltr">2</span>{{ t('poster_step2') }}</li>
          <li><span class="ps-n" dir="ltr">3</span>{{ t('poster_step3') }}</li>
        </ol>

        <p class="poster-url" dir="ltr">{{ registerUrl }}</p>
      </div>
    </template>

    <div v-else class="loading"><span class="fc-spin"></span></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import BrandLogo from '@/components/BrandLogo.vue';
import { useSettingsStore } from '@/stores/settings.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const { t } = useI18n();
const settings = useSettingsStore();
const auth = useAuthStore();
const ui = useUiStore();

const form = ref(null);
const saving = ref(false);

// Only managers may persist changes.
const canSave = computed(() => auth.isManager);

/**
 * The poster QR points at wherever this browser is actually reaching the app —
 * that is the address a parent's phone needs. On localhost it cannot work from a
 * phone, so we say so rather than printing a dead code.
 */
const registerUrl = computed(() => `${window.location.origin}/register`);
const urlIsLocal = computed(() => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(window.location.origin));
const regQr = ref('');

async function makeRegQr() {
  try {
    regQr.value = await QRCode.toDataURL(registerUrl.value, {
      margin: 1,
      width: 640,
      errorCorrectionLevel: 'M',
      color: { dark: '#231F1B', light: '#ffffff' },
    });
  } catch {
    regQr.value = '';
  }
}

function printPoster() {
  window.print();
}

const colors = ['#F97A53', '#12A594', '#7C5CE0', '#EC6A9C', '#F5A623'];

const waGroups = [
  { key: 'welcome', labelKey: 'se_wa_welcome', vars: ['{name}', '{الاسم}', '{code}', '{الرمز}'] },
  { key: 'warn_5', labelKey: 'se_wa_warning', vars: ['{child}', '{الطفل}'] },
  { key: 'time_up', labelKey: 'se_wa_overtime', vars: ['{child}', '{الطفل}', '{minutes}', '{الدقائق}'] },
];

function durationLabel(min) {
  if (min === 30) return t('dur30');
  if (min === 60) return t('dur60');
  if (min === 120) return t('dur120');
  return `${min} ${t('mins')}`;
}

onMounted(async () => {
  makeRegQr();
  try {
    await settings.fetch();
    const clone = JSON.parse(JSON.stringify(settings.data || {}));

    // Defensive defaults so v-model bindings never hit undefined nesting.
    clone.durations = Array.isArray(clone.durations) ? clone.durations : [];
    if (clone.late_fee_per_minute == null) clone.late_fee_per_minute = 0;
    clone.center_name = clone.center_name ?? '';
    clone.tagline = clone.tagline ?? '';
    clone.primary_color = clone.primary_color ?? colors[0];

    const wt = clone.wa_templates || {};
    clone.wa_templates = {
      welcome: { ar: wt.welcome?.ar ?? '', en: wt.welcome?.en ?? '' },
      warn_5: { ar: wt.warn_5?.ar ?? '', en: wt.warn_5?.en ?? '' },
      time_up: { ar: wt.time_up?.ar ?? '', en: wt.time_up?.en ?? '' },
    };

    form.value = clone;
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
  }
});

async function save() {
  if (!canSave.value || saving.value || !form.value) return;
  saving.value = true;
  try {
    await settings.update({
      durations: form.value.durations.map((d) => ({ ...d, price: Number(d.price) })),
      late_fee_per_minute: Number(form.value.late_fee_per_minute),
      center_name: form.value.center_name,
      tagline: form.value.tagline,
      primary_color: form.value.primary_color,
      wa_templates: form.value.wa_templates,
    });
    ui.toast(t('se_saved'), 'success');
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.settings-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.wrap {
  flex: 1;
  width: 100%;
  max-width: 760px;
  margin-inline: auto;
  padding: 22px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.page-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-title {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 28px;
  color: var(--ink);
  margin: 0;
}

/* Sections */
.sec {
  padding: 22px;
  background: var(--surface);
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sec-icon {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.sec-title {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 18px;
  color: var(--ink);
}
.sec-note {
  font-size: 12.5px;
  color: var(--muted-3);
}
.sec-hint {
  font-size: 12.5px;
  color: var(--muted-3);
  margin-top: 4px;
  margin-bottom: 16px;
}

/* Durations */
.dur-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dur-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface-2);
  border: 1.5px solid var(--line-soft);
  border-radius: 14px;
  padding: 10px 14px;
}
.dur-label {
  flex: 1;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 17px;
  color: var(--ink);
}

/* Number field (shared by durations + late rate) */
.num-field {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 2px solid var(--line-3);
  border-radius: 11px;
  padding: 0 12px;
  height: 44px;
  flex: none;
}
.num-field:focus-within {
  border-color: var(--brand);
}
.num-input {
  width: 66px;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 17px;
  color: var(--accent);
  text-align: center;
  -moz-appearance: textfield;
  appearance: textfield;
}
.num-input::-webkit-outer-spin-button,
.num-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.num-suffix {
  font-size: 13px;
  color: var(--muted-3);
  font-weight: 700;
}

/* Late rate */
.late-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--line-4);
}
.late-title {
  font-weight: 700;
  font-size: 15px;
  color: var(--ink);
}
.late-sub {
  font-size: 12px;
  color: var(--muted-3);
  margin-top: 2px;
}

/* WhatsApp */
.wa-group {
  margin-top: 18px;
}
.wa-group:first-of-type {
  margin-top: 16px;
}
.wa-label {
  display: block;
  font-size: 12.5px;
  color: var(--muted-strong);
  font-weight: 700;
  margin-bottom: 8px;
}
.wa-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.wa-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wa-lang {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted-2);
}
.wa-textarea {
  width: 100%;
  height: 96px;
  border: 2px solid var(--line-3);
  border-radius: 12px;
  background: var(--surface-2);
  padding: 10px 12px;
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.6;
  color: var(--ink);
  outline: none;
  resize: vertical;
}
.wa-textarea:focus {
  border-color: var(--brand);
}
.wa-vars {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.wa-vars-label {
  font-size: 12px;
  color: var(--muted-3);
  font-weight: 700;
}
.wa-chip {
  background: var(--line-soft);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  font-family: monospace;
}

/* Branding */
.field-label {
  display: block;
  font-size: 12.5px;
  color: var(--muted-strong);
  font-weight: 700;
  margin: 14px 0 6px;
}
.field-label.first {
  margin-top: 8px;
}
.swatch-row {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
.swatch {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 3px solid transparent;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 4px 10px -5px rgba(60, 40, 20, 0.5);
  transition: transform 0.1s ease;
}
.swatch:hover {
  transform: translateY(-1px);
}
.swatch.sel {
  border-color: var(--ink);
  box-shadow: 0 0 0 2px #fff inset, 0 4px 10px -5px rgba(60, 40, 20, 0.5);
}

/* Sticky footer */
.save-bar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(8px);
  border-top: 1.5px solid var(--line-2);
}
.save-inner {
  width: 100%;
  max-width: 760px;
  margin-inline: auto;
  padding: 14px 28px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
}
.save-note {
  font-size: 12.5px;
  color: var(--muted-2);
}
.save-btn {
  height: 50px;
  padding: 0 26px;
  font-size: 15px;
}
.fc-spin.small {
  width: 22px;
  height: 22px;
  border-width: 3px;
  border-top-color: #fff;
}

/* Loading */
.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px;
}

/* ---- registration poster (on screen) ---- */
.qr-row { display: flex; gap: 20px; align-items: center; margin-top: 4px; }
.qr-box {
  width: 164px; height: 164px; flex: none;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--line-2); border-radius: var(--r-md);
  background: #fff; padding: 10px;
}
.qr-box img { display: block; width: 100%; height: 100%; }
.qr-meta { min-width: 0; }
.qr-url-lbl { font-size: 12px; font-weight: 700; color: var(--muted-3); }
.qr-url {
  font-size: 13px; color: var(--muted-strong); word-break: break-all;
  background: var(--chip); border-radius: 10px; padding: 8px 11px; margin-top: 5px;
}
.qr-warn {
  margin: 10px 0 0; font-size: 12.5px; line-height: 1.55;
  background: #FFF8EC; color: #8A5A00; border: 1px solid #F6DFA6;
  border-radius: 10px; padding: 9px 12px;
}
.qr-print { height: 44px; padding: 0 16px; margin-top: 12px; }

/* ---- the printed sheet ---- */
.poster { display: none; }

@media (max-width: 620px) {
  .qr-row { flex-direction: column; align-items: stretch; }
  .qr-box { align-self: center; }
}

@media print {
  /* Print the poster alone — the app chrome is hidden globally in styles.css. */
  .wrap, .save-bar, .loading { display: none !important; }

  .poster {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 14mm 12mm;
    gap: 0;
  }
  .poster-title {
    font-family: var(--font-head); font-weight: 800;
    font-size: 34pt; color: var(--ink); margin: 8mm 0 0;
  }
  .poster-sub { font-size: 13pt; color: #5A4E40; margin: 3mm 0 0; max-width: 46ch; line-height: 1.6; }
  .poster-qr {
    margin: 8mm 0 0; padding: 5mm; background: #fff;
    border: 2px solid #E4D9C8; border-radius: 6mm;
  }
  .poster-qr img { display: block; width: 72mm; height: 72mm; }
  .poster-steps {
    list-style: none; margin: 9mm 0 0; padding: 0;
    display: flex; flex-direction: column; gap: 4mm;
    text-align: start; max-width: 108mm; width: 100%;
  }
  .poster-steps li {
    display: flex; align-items: center; gap: 4mm;
    font-size: 12pt; color: var(--ink);
  }
  .ps-n {
    width: 8mm; height: 8mm; flex: none; border-radius: 2.5mm;
    background: var(--brand); color: #fff;
    display: inline-flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 11pt;
  }
  .poster-url { margin: 9mm 0 0; font-size: 9pt; color: #9A8C7A; }

  @page { size: A4 portrait; margin: 0; }
}
</style>
