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

          <!-- Which of the two columns below is actually sent, when the family
               has no language of its own on file. -->
          <div class="inline-num lang-row">
            <label class="field-label first">{{ t('se_default_lang') }}</label>
            <select class="fc-input narrow" v-model="form.default_lang">
              <option value="ar">عربي</option>
              <option value="en">English</option>
            </select>
            <span class="sec-note">· {{ t('se_default_lang_hint') }}</span>
          </div>

          <div v-for="g in waGroups" :key="g.key" class="wa-group">
            <label class="wa-label">{{ t(g.labelKey) }}</label>
            <p v-if="g.noteKey" class="wa-note">{{ t(g.noteKey) }}</p>
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

        <!-- 5) Centre terms — the page customers read from the consent statement -->
        <section class="fc-card sec">
          <div class="sec-head">
            <span class="sec-icon" style="background:#E8F2FB;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3E97D8" stroke-width="2.1">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" />
              </svg>
            </span>
            <div class="sec-title">{{ t('se_terms') }}</div>
          </div>
          <div class="sec-hint">{{ t('se_terms_hint') }}</div>

          <!-- The terms themselves, served at /terms. Plain text: line breaks are kept. -->
          <div class="wa-fields">
            <div class="wa-field">
              <span class="wa-lang">عربي</span>
              <textarea class="wa-textarea terms-area" dir="rtl" maxlength="20000" v-model="form.terms_ar"></textarea>
            </div>
            <div class="wa-field">
              <span class="wa-lang">English</span>
              <textarea class="wa-textarea terms-area" dir="ltr" maxlength="20000" v-model="form.terms_en"></textarea>
            </div>
          </div>
          <a class="terms-view" href="/terms" target="_blank" rel="noopener">{{ t('se_terms_view') }} ↗</a>

          <label class="field-label" for="se-terms">{{ t('se_terms_url') }}</label>
          <input id="se-terms" class="fc-input" dir="ltr" type="url" placeholder="https://…" v-model="form.terms_url" />
          <div class="sec-hint sm">{{ t('se_terms_url_hint') }}</div>
        </section>

        <!-- 6) Parties & workshops -->
        <section class="fc-card sec">
          <div class="sec-head">
            <span class="sec-icon" style="background:#EFEAFB;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C5CE0" stroke-width="2.1">
                <path d="M4 20l5-13 7 7-12 6zM14 4l1 2M18 3l-.5 2.5M20 8l-2 .5" />
              </svg>
            </span>
            <div class="sec-title">{{ t('se_bookings') }}</div>
          </div>

          <div v-for="k in ['party', 'workshop']" :key="k" class="bk-block">
            <div class="bk-block-head">
              <span class="bk-block-t">{{ k === 'party' ? t('bk_party') : t('bk_workshop') }}</span>
              <label class="toggle">
                <input type="checkbox" v-model="form.booking_config[k].enabled" />
                <span>{{ t('se_bk_enabled') }}</span>
              </label>
            </div>

            <div class="grid4">
              <div>
                <label class="field-label first">{{ t('se_bk_base') }}</label>
                <input class="fc-input" type="number" min="0" dir="ltr" v-model.number="form.booking_config[k].base_price" />
              </div>
              <div>
                <label class="field-label first">{{ t('se_bk_per_child') }}</label>
                <input class="fc-input" type="number" min="0" dir="ltr" v-model.number="form.booking_config[k].price_per_child" />
              </div>
              <div>
                <label class="field-label first">{{ t('se_bk_duration') }}</label>
                <input class="fc-input" type="number" min="15" step="15" dir="ltr" v-model.number="form.booking_config[k].duration_minutes" />
              </div>
              <div>
                <label class="field-label first">{{ t('se_bk_lead') }}</label>
                <input class="fc-input" type="number" min="0" dir="ltr" v-model.number="form.booking_config[k].lead_hours" />
              </div>
              <div>
                <label class="field-label first">{{ t('se_bk_min') }}</label>
                <input class="fc-input" type="number" min="1" dir="ltr" v-model.number="form.booking_config[k].min_children" />
              </div>
              <div>
                <label class="field-label first">{{ t('se_bk_max') }}</label>
                <input class="fc-input" type="number" min="1" dir="ltr" v-model.number="form.booking_config[k].max_children" />
              </div>
            </div>

            <label class="field-label">{{ t('se_bk_slots') }}</label>
            <input class="fc-input" dir="ltr" placeholder="12:00, 15:00, 18:00" v-model="slotText[k]" />
            <div class="sec-hint sm">{{ t('se_bk_slots_hint') }}</div>
          </div>
        </section>

        <!-- 7) Reviews + guardian self-extension -->
        <section class="fc-card sec">
          <div class="sec-head">
            <span class="sec-icon" style="background:#FDF0DC;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5A623" stroke-width="2.1" stroke-linejoin="round">
                <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z" />
              </svg>
            </span>
            <div class="sec-title">{{ t('se_reviews') }}</div>
          </div>

          <label class="toggle block">
            <input type="checkbox" v-model="form.reviews_enabled" />
            <span>{{ t('se_reviews_on') }}</span>
          </label>
          <div v-if="form.reviews_enabled" class="inline-num">
            <label class="field-label first">{{ t('se_review_delay') }}</label>
            <input class="fc-input narrow" type="number" min="0" max="10080" dir="ltr" v-model.number="form.review_delay_minutes" />
          </div>

          <div class="divider"></div>

          <div class="sec-title sm">{{ t('se_extend') }}</div>
          <label class="toggle block">
            <input type="checkbox" v-model="form.guardian_extend_enabled" />
            <span>{{ t('se_extend_on') }}</span>
          </label>
          <div v-if="form.guardian_extend_enabled" class="inline-num">
            <label class="field-label first">{{ t('se_extend_minutes') }}</label>
            <input class="fc-input narrow" type="number" min="5" max="600" step="5" dir="ltr" v-model.number="form.guardian_extend_minutes" />
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
  {
    key: 'welcome',
    labelKey: 'se_wa_welcome',
    noteKey: 'se_wa_welcome_note',
    vars: ['{name}', '{الاسم}', '{code}', '{الرمز}', '{center}', '{المركز}'],
  },
  // {link} is the mother's one-tap "add time" link, and {minutes} is how much
  // it adds — it tracks the extension setting below instead of being typed in.
  {
    key: 'warn_5',
    labelKey: 'se_wa_warning',
    noteKey: 'se_wa_warning_note',
    vars: ['{child}', '{الطفل}', '{minutes}', '{الدقائق}', '{link}', '{الرابط}', '{center}', '{المركز}'],
  },
  // {minutes} is deliberately NOT offered here: this message is sent AT the end
  // of the session, so overtime is always zero at that moment.
  {
    key: 'time_up',
    labelKey: 'se_wa_overtime',
    noteKey: 'se_wa_overtime_note',
    vars: ['{child}', '{الطفل}', '{center}', '{المركز}'],
  },
  {
    key: 'review',
    labelKey: 'se_wa_review',
    vars: ['{name}', '{الاسم}', '{center}', '{المركز}', '{link}', '{الرابط}'],
  },
  {
    key: 'booking_confirmed',
    labelKey: 'se_wa_booking',
    noteKey: 'se_wa_booking_note',
    vars: ['{name}', '{الاسم}', '{ref}', '{المرجع}', '{date}', '{التاريخ}', '{time}', '{الوقت}',
      '{count}', '{العدد}', '{amount}', '{المبلغ}', '{center}', '{المركز}'],
  },
];

/**
 * Slots live in the model as an array but are far easier to edit as one comma
 * separated line, so the two are kept in sync around the text field.
 */
const slotText = ref({ party: '', workshop: '' });
const parseSlots = (text) => String(text || '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => /^\d{1,2}:\d{2}$/.test(s))
  .map((s) => (s.length === 4 ? `0${s}` : s));

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
      review: { ar: wt.review?.ar ?? '', en: wt.review?.en ?? '' },
      booking_confirmed: { ar: wt.booking_confirmed?.ar ?? '', en: wt.booking_confirmed?.en ?? '' },
    };
    clone.default_lang = clone.default_lang === 'en' ? 'en' : 'ar';

    clone.terms_url = clone.terms_url ?? '';
    clone.terms_ar = clone.terms_ar ?? '';
    clone.terms_en = clone.terms_en ?? '';
    if (clone.reviews_enabled == null) clone.reviews_enabled = true;
    if (clone.review_delay_minutes == null) clone.review_delay_minutes = 45;
    if (clone.guardian_extend_enabled == null) clone.guardian_extend_enabled = true;
    if (clone.guardian_extend_minutes == null) clone.guardian_extend_minutes = 60;

    const bc = clone.booking_config || {};
    const kind = (k, d) => ({
      enabled: bc[k]?.enabled ?? true,
      base_price: Number(bc[k]?.base_price ?? d.base),
      price_per_child: Number(bc[k]?.price_per_child ?? d.per),
      min_children: Number(bc[k]?.min_children ?? d.min),
      max_children: Number(bc[k]?.max_children ?? d.max),
      duration_minutes: Number(bc[k]?.duration_minutes ?? d.dur),
      slots: Array.isArray(bc[k]?.slots) ? bc[k].slots : d.slots,
      lead_hours: Number(bc[k]?.lead_hours ?? 24),
    });
    clone.booking_config = {
      party: kind('party', { base: 500, per: 35, min: 5, max: 40, dur: 120, slots: ['12:00', '15:00', '18:00'] }),
      workshop: kind('workshop', { base: 0, per: 60, min: 1, max: 20, dur: 90, slots: ['10:00', '16:00'] }),
      themes: bc.themes || [],
      foods: bc.foods || [],
    };
    slotText.value = {
      party: clone.booking_config.party.slots.join(', '),
      workshop: clone.booking_config.workshop.slots.join(', '),
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
    const bc = form.value.booking_config;
    await settings.update({
      durations: form.value.durations.map((d) => ({ ...d, price: Number(d.price) })),
      late_fee_per_minute: Number(form.value.late_fee_per_minute),
      center_name: form.value.center_name,
      tagline: form.value.tagline,
      primary_color: form.value.primary_color,
      wa_templates: form.value.wa_templates,
      terms_url: form.value.terms_url?.trim() || null,
      terms_ar: form.value.terms_ar || null,
      terms_en: form.value.terms_en || null,
      booking_config: {
        ...bc,
        party: { ...bc.party, slots: parseSlots(slotText.value.party) },
        workshop: { ...bc.workshop, slots: parseSlots(slotText.value.workshop) },
      },
      reviews_enabled: form.value.reviews_enabled,
      review_delay_minutes: Number(form.value.review_delay_minutes),
      guardian_extend_enabled: form.value.guardian_extend_enabled,
      guardian_extend_minutes: Number(form.value.guardian_extend_minutes),
      default_lang: form.value.default_lang,
    });
    // Reflect the normalised slot list back into the text field.
    slotText.value = {
      party: (settings.data.booking_config?.party?.slots || []).join(', '),
      workshop: (settings.data.booking_config?.workshop?.slots || []).join(', '),
    };
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
/* Full-bleed, like the dashboard. The sections TILE rather than stretch — a
   settings form stretched to 1920px is unreadable, so the width buys extra
   columns instead of extra line length.
   CSS columns rather than grid: the sections differ wildly in height (the
   WhatsApp card is ~4x the branding card), and a grid aligns row baselines, so
   every short card would sit above a tall void. Columns pack by height. Each
   section is self-contained, so reading down a column is fine. */
.wrap {
  flex: 1;
  width: 100%;
  padding: 22px 28px 28px;
  columns: 460px;
  column-gap: 18px;
}
.wrap > .sec {
  break-inside: avoid;
  margin-bottom: 18px;
}
.page-head { column-span: all; }
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
.sec-hint.sm { margin-top: 6px; margin-bottom: 0; }
.sec-title.sm { font-size: 15px; margin-bottom: 10px; }

/* Bookings + reviews blocks */
.bk-block { border-top: 1px solid var(--line-soft); padding-top: 16px; margin-top: 16px; }
.bk-block:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
.bk-block-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.bk-block-t { font-family: var(--font-head); font-weight: 800; font-size: 16px; color: var(--ink); }
.grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.toggle { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; font-size: 13.5px; font-weight: 700; color: var(--muted-strong); }
.toggle.block { display: flex; margin-bottom: 12px; }
.toggle input { width: 22px; height: 22px; accent-color: var(--brand); cursor: pointer; flex: none; }
.inline-num { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.inline-num .field-label { margin: 0; }
.fc-input.narrow { width: 120px; }
.divider { height: 1px; background: var(--line-soft); margin: 20px 0; }

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
/* When a template needs a caveat the variable chips can't carry — e.g. why the
   overtime message has no minutes in it. */
.wa-note {
  margin: -4px 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted-3);
}
.lang-row { margin-bottom: 18px; }
.wa-textarea.terms-area { height: 240px; }
.terms-view { display: inline-block; margin-top: 10px; font-size: 13px; font-weight: 700; color: var(--accent); text-decoration: underline; }
/* The ar/en pair sits side by side when the card is wide and stacks once the
   card becomes one column of a multi-column settings grid. */
.wa-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
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
