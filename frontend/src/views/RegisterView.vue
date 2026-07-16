<template>
  <div class="reg-root">
    <button class="lang-fab" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

    <!-- ============================ FORM ============================ -->
    <template v-if="mode === 'form'">
      <!-- full-bleed welcome band -->
      <header class="hero">
        <div class="hero-deco" aria-hidden="true">
          <span class="blob h1"></span>
          <span class="blob h2"></span>
        </div>
        <div class="hero-inner">
          <BrandLogo :size="54" :show-text="true" tone="inverse" class="hero-logo" />
          <h1 class="hero-title">{{ t('rg_welcome') }}</h1>
          <p class="hero-sub">{{ t('rg_sub') }}</p>
        </div>
      </header>

      <div class="wrap screen-in">
        <div class="cols">
          <!-- ---------------- guardian ---------------- -->
          <section class="fc-card pane">
            <div class="sec-title">
              <span class="sec-ic ic-guardian">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E85D3D" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
              </span>
              {{ t('rg_mother_info') }}
            </div>

            <div class="field">
              <label class="lbl" for="rg-name">{{ t('rg_full_name') }}</label>
              <input id="rg-name" v-model="full_name" class="fc-input" :placeholder="t('rg_full_name_ph')" autocomplete="name" />
            </div>

            <div class="pair">
              <div class="field">
                <label class="lbl" for="rg-phone">{{ t('rg_phone') }}</label>
                <input id="rg-phone" v-model="phone" class="fc-input" dir="ltr" inputmode="tel" :placeholder="t('rg_phone_ph')" autocomplete="tel" />
              </div>

              <div class="field">
                <label class="lbl lbl-row" for="rg-nid">
                  {{ t('rg_natid') }}
                  <span class="opt-tag">{{ t('rg_optional') }}</span>
                </label>
                <input id="rg-nid" v-model="national_id" class="fc-input" dir="ltr" inputmode="numeric" :placeholder="t('rg_natid_ph')" />
              </div>
            </div>
          </section>

          <!-- ---------------- children ---------------- -->
          <section class="fc-card pane">
            <div class="sec-title sec-title-row">
              <span class="sec-title-l">
                <span class="sec-ic ic-child">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2.2" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 0 1 0 6M18 20c0-2-1-3.5-2.5-4.3" /></svg>
                </span>
                {{ t('rg_children') }}
              </span>
              <span class="count-pill" dir="ltr">{{ children.length }}</span>
            </div>

            <div class="kids">
              <div v-for="(ch, i) in children" :key="i" class="child-card">
                <div class="child-head">
                  <span class="child-tag">
                    <span class="child-num" dir="ltr">{{ i + 1 }}</span>
                    {{ t('rg_child') }} {{ i + 1 }}
                  </span>
                  <button v-if="children.length > 1" class="child-remove" type="button" @click="removeChild(i)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D08770" stroke-width="2.4" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    {{ t('rg_remove') }}
                  </button>
                </div>

                <input v-model="ch.name" class="fc-input" :placeholder="t('rg_child_name_ph')" :aria-label="`${t('rg_child')} ${i + 1}`" />

                <div class="child-row">
                  <input v-model="ch.age" class="fc-input age-input" inputmode="numeric" :placeholder="t('rg_age_ph')" :aria-label="t('rg_age')" />
                  <button
                    type="button"
                    class="gender-btn"
                    :class="{ 'boy-on': ch.gender === 'm' }"
                    :aria-pressed="ch.gender === 'm'"
                    @click="ch.gender = 'm'"
                  >{{ t('boy') }}</button>
                  <button
                    type="button"
                    class="gender-btn"
                    :class="{ 'girl-on': ch.gender === 'f' }"
                    :aria-pressed="ch.gender === 'f'"
                    @click="ch.gender = 'f'"
                  >{{ t('girl') }}</button>
                </div>
              </div>
            </div>

            <button class="add-child" type="button" @click="addChild">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E85D3D" stroke-width="2.6" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              {{ t('rg_add_child') }}
            </button>
          </section>
        </div>
      </div>

      <!-- full-bleed action bar: consent sits with the button it gates -->
      <div class="action-bar">
        <div class="ab-inner">
          <button type="button" class="consent" :aria-pressed="consent" @click="consent = !consent">
            <span class="cbox" :class="{ on: consent }">
              <svg v-if="consent" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <span class="consent-txt">{{ t('rg_consent') }}</span>
          </button>

          <button class="fc-btn fc-btn-primary submit-btn" type="button" :disabled="!canSubmit || submitting" @click="submit">
            <span v-if="submitting" class="fc-spin small"></span>
            <span v-else>{{ t('rg_submit') }}</span>
          </button>
        </div>
      </div>
    </template>

    <!-- ============================ DONE ============================ -->
    <div v-else class="done-wrap screen-in">
      <div class="done-cols">
        <div class="done-say">
          <div class="success-badge">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 class="done-title">{{ result?.already_registered ? t('rg_exists') : t('rg_done_title') }}</h1>
          <p class="done-sub">{{ t('rg_done_sub') }}</p>

          <div class="scan-note">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E8C7E" stroke-width="2.2" class="scan-ic" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
            <span>{{ t('rg_scan_next') }}</span>
          </div>

          <div class="done-foot">
            <button class="fc-btn fc-btn-ghost save-btn" type="button" :title="t('rg_save')" :aria-label="t('rg_save')" @click="printCard">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B5D4C" stroke-width="2.2" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
            </button>
            <button class="fc-btn fc-btn-primary home-btn" type="button" @click="reset">
              {{ t('rg_done_home') }}
            </button>
          </div>
        </div>

        <div class="done-card-col">
          <div class="personal-card">
            <div class="pc-brand">
              <BrandLogo :size="34" :show-text="true" />
            </div>
            <div class="pc-qr">
              <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR" width="176" height="176" />
            </div>
            <div class="pc-name">{{ result?.full_name }}</div>
            <div class="pc-code-lbl">{{ t('rg_your_code') }}</div>
            <div class="pc-code" dir="ltr">{{ result?.customer_code }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import BrandLogo from '@/components/BrandLogo.vue';
import { useCustomersStore } from '@/stores/customers.js';
import { useUiStore } from '@/stores/ui.js';

const { t } = useI18n();
const customers = useCustomersStore();
const ui = useUiStore();

const mode = ref('form'); // 'form' | 'done'
const result = ref(null);
const qrDataUrl = ref('');
const submitting = ref(false);

const full_name = ref('');
const phone = ref('');
const national_id = ref('');
const consent = ref(false);
const children = ref([{ name: '', age: '', gender: '' }]);

function addChild() {
  children.value.push({ name: '', age: '', gender: '' });
}
function removeChild(i) {
  children.value.splice(i, 1);
}

const canSubmit = computed(() =>
  full_name.value.trim().length > 0
  && phone.value.trim().length >= 6
  && consent.value
  && children.value.some((c) => c.name.trim().length > 0));

async function genQr(url) {
  try {
    qrDataUrl.value = await QRCode.toDataURL(url, {
      margin: 1,
      width: 200,
      color: { dark: '#231F1B', light: '#ffffff' },
    });
  } catch {
    qrDataUrl.value = '';
  }
}

async function submit() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    const cust = await customers.register({
      full_name: full_name.value.trim(),
      phone: phone.value.trim(),
      national_id: national_id.value || null,
      consent: true,
      children: children.value
        .filter((c) => c.name.trim())
        .map((c) => ({ name: c.name.trim(), age: c.age || null, gender: c.gender || null })),
    });
    result.value = cust;
    await genQr(cust.card_url);
    if (cust.already_registered) ui.toast(t('rg_exists'), 'info');
    mode.value = 'done';
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    submitting.value = false;
  }
}

function printCard() {
  window.print();
}

// Home = reset to a fresh blank form so the next family can register.
function reset() {
  full_name.value = '';
  phone.value = '';
  national_id.value = '';
  consent.value = false;
  children.value = [{ name: '', age: '', gender: '' }];
  result.value = null;
  qrDataUrl.value = '';
  mode.value = 'form';
}
</script>

<style scoped>
.reg-root { min-height: 100vh; padding-bottom: 104px; position: relative; }

.lang-fab {
  position: absolute; top: 20px; inset-inline-end: 20px;
  height: 38px; padding: 0 15px;
  border: 2px solid rgba(255, 255, 255, .5);
  background: rgba(255, 255, 255, .18);
  border-radius: 12px;
  color: #fff; font-weight: 700; font-size: 13px; cursor: pointer;
  z-index: 5;
  backdrop-filter: blur(4px);
}
.lang-fab:hover { background: rgba(255, 255, 255, .28); }

/* ---------------- hero ---------------- */
.hero {
  position: relative;
  overflow: hidden;
  padding: 46px 6vw 54px;
  background: linear-gradient(140deg, var(--brand) 0%, #F58C4E 52%, var(--brand-2) 100%);
  color: #fff;
  text-align: center;
}
.hero-deco { position: absolute; inset: 0; pointer-events: none; }
.blob { position: absolute; border-radius: 50%; background: rgba(255, 255, 255, .1); }
.h1 { width: 260px; height: 260px; top: -110px; inset-inline-start: -60px; animation: fcFloat 15s ease-in-out infinite; }
.h2 { width: 150px; height: 150px; bottom: -70px; inset-inline-end: 8%; background: rgba(255, 255, 255, .08); animation: fcFloat 12s ease-in-out infinite reverse; }
.hero-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; }
.hero-logo { margin-bottom: 16px; }
.hero-title { font-family: var(--font-head); font-weight: 800; font-size: clamp(24px, 3vw, 34px); margin: 0; }
.hero-sub { font-size: 14.5px; line-height: 1.6; margin: 8px 0 0; opacity: .95; max-width: 52ch; }

/* ---------------- body ---------------- */
/* The cards rise 26px into the hero. .hero is positioned, so without a stacking
   nudge here it would paint over them and bury their top edge. */
.wrap { position: relative; z-index: 1; max-width: 1120px; margin: 0 auto; padding: 0 24px; }
.cols { display: grid; grid-template-columns: 1fr 1.15fr; gap: 20px; margin-top: -26px; }
.pane { background: #fff; padding: 22px 24px 24px; }

.sec-title {
  font-family: var(--font-head); font-weight: 800; font-size: 16px; color: var(--ink);
  margin: 0 0 16px; display: flex; align-items: center; gap: 9px;
}
.sec-title-row { justify-content: space-between; }
.sec-title-l { display: inline-flex; align-items: center; gap: 9px; }
.sec-ic { width: 28px; height: 28px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.ic-guardian { background: #FCE1D4; }
.ic-child { background: #DCF0EC; }
.count-pill { background: #EAF7F4; color: #0E8C7E; font-weight: 800; font-size: 13px; padding: 4px 11px; border-radius: 999px; }

.field { margin-bottom: 14px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.lbl { display: block; font-size: 13px; font-weight: 700; color: var(--muted-strong); margin-bottom: 6px; }
.lbl-row { display: flex; align-items: center; gap: 8px; }
.opt-tag { background: var(--line-soft); color: var(--muted-3); font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }

/* children */
/* auto-fit (not auto-fill) so a lone child fills the pane instead of leaving
   an empty track beside it; two or more then sit side by side. */
.kids { display: grid; grid-template-columns: repeat(auto-fit, minmax(248px, 1fr)); gap: 12px; }
.child-card {
  border: 2px solid var(--line-2); border-radius: var(--r-md);
  padding: 14px; background: var(--surface-2);
}
.child-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.child-tag { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; color: var(--ink); font-size: 14px; }
.child-num { width: 24px; height: 24px; border-radius: 8px; background: var(--brand); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
.child-remove { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: #C0876B; cursor: pointer; font-weight: 700; font-size: 13px; }
.child-row { display: flex; gap: 10px; margin-top: 10px; }
.age-input { width: 84px; flex: none; text-align: center; padding: 0 8px; }
.gender-btn {
  flex: 1; height: 52px;
  border: 2px solid var(--line-3); border-radius: 14px;
  background: #fff; color: var(--muted-strong);
  font-family: var(--font-body); font-weight: 700; font-size: 15px;
  cursor: pointer; transition: all .15s ease;
}
.gender-btn.boy-on { border-color: var(--blue); background: #E8F2FB; color: var(--blue); }
.gender-btn.girl-on { border-color: var(--pink); background: #FCE9F1; color: var(--pink); }

.add-child {
  width: 100%; height: 48px; margin-top: 12px;
  border: 2px dashed #E4A78E; background: #FFF6F1; border-radius: 14px;
  color: var(--accent); font-family: var(--font-body); font-weight: 700; font-size: 15px;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
}
.add-child:hover { background: #FFEFE6; }

/* ---------------- action bar ---------------- */
.action-bar {
  position: fixed; bottom: 0; inset-inline: 0; z-index: 10;
  background: rgba(255, 253, 249, .94);
  border-top: 1px solid var(--line);
  backdrop-filter: blur(8px);
}
.ab-inner {
  max-width: 1120px; margin: 0 auto; padding: 14px 24px;
  display: flex; align-items: center; gap: 20px;
}
.consent {
  display: flex; align-items: center; gap: 11px; flex: 1;
  text-align: start; background: none; border: none; cursor: pointer; padding: 0;
}
.cbox {
  width: 24px; height: 24px; flex: none; border-radius: 8px;
  border: 2px solid var(--line-3); background: #fff;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s ease;
}
.cbox.on { background: var(--brand); border-color: var(--brand); }
.consent-txt { font-size: 13px; color: var(--muted-strong); line-height: 1.5; }
.submit-btn { flex: none; min-width: 240px; height: 52px; font-size: 16px; }
.fc-spin.small { width: 22px; height: 22px; border-width: 3px; }

/* ---------------- done ---------------- */
.done-wrap { max-width: 1000px; margin: 0 auto; padding: 6vh 24px 40px; }
.done-cols { display: grid; grid-template-columns: 1fr auto; gap: 44px; align-items: center; }
.done-say { max-width: 46ch; }
.success-badge {
  width: 76px; height: 76px; border-radius: 50%; background: var(--play);
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-play); animation: fcPop .4s ease;
}
.done-title { font-family: var(--font-head); font-weight: 800; font-size: clamp(24px, 2.6vw, 32px); color: var(--ink); margin: 20px 0 0; }
.done-sub { font-size: 15px; color: var(--muted-2); margin: 8px 0 0; }
.scan-note {
  display: flex; align-items: flex-start; gap: 10px;
  background: #EAF7F4; border-radius: 16px; padding: 14px 16px; margin-top: 22px;
}
.scan-ic { flex: none; margin-top: 2px; }
.scan-note span { font-size: 13px; color: #0E8C7E; line-height: 1.55; }
.done-foot { display: flex; gap: 10px; margin-top: 24px; }
.save-btn { flex: none; width: 56px; height: 54px; padding: 0; }
.home-btn { flex: 1; max-width: 260px; height: 54px; font-family: var(--font-head); font-size: 17px; }

.done-card-col { display: flex; justify-content: center; }
.personal-card {
  background: #fff; border: 1px solid var(--line-2); border-radius: 24px;
  padding: 24px; width: 320px; text-align: center;
  box-shadow: var(--shadow-pop);
}
.pc-brand { display: flex; justify-content: center; margin-bottom: 16px; }
.pc-qr { display: flex; justify-content: center; }
.pc-qr img { border: 2px solid var(--line-soft); border-radius: 16px; padding: 10px; background: #fff; display: block; }
.pc-name { font-weight: 700; font-size: 16px; color: var(--ink); margin-top: 16px; }
.pc-code-lbl { font-size: 12px; color: var(--muted-2); margin-top: 10px; }
.pc-code { font-family: var(--font-head); font-weight: 800; font-size: 23px; color: var(--accent); letter-spacing: 2px; margin-top: 2px; }

/* ---------------- responsive ---------------- */
@media (max-width: 900px) {
  .cols { grid-template-columns: 1fr; }
  .done-cols { grid-template-columns: 1fr; gap: 28px; }
  .done-say { max-width: none; }
  .done-card-col { order: -1; }
  .home-btn { max-width: none; }
}
@media (max-width: 620px) {
  .reg-root { padding-bottom: 132px; }
  .hero { padding: 38px 20px 46px; }
  .wrap { padding: 0 16px; }
  .pane { padding: 18px 16px 20px; }
  .pair { grid-template-columns: 1fr; gap: 0; }
  .kids { grid-template-columns: 1fr; }
  .ab-inner { flex-direction: column; align-items: stretch; gap: 12px; padding: 12px 16px; }
  .submit-btn { min-width: 0; width: 100%; }
}

@media print {
  .lang-fab, .hero, .action-bar, .done-foot, .success-badge, .done-title, .done-sub, .scan-note { display: none !important; }
  .reg-root { padding: 0; }
  .done-wrap { padding: 0; }
  .done-cols { display: block; }
  .personal-card { box-shadow: none; border: 1px solid #E4D9C8; margin: 0 auto; }
}
</style>
