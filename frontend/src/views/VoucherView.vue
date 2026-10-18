<template>
  <div class="card-wrap">
    <button class="lang-fab" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

    <div class="card-shell">
      <div v-if="loading" class="state"><span class="fc-spin"></span></div>

      <div v-else-if="notFound" class="state screen-in">
        <div class="nf-badge">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
        </div>
        <div class="nf-title">{{ t('vc_not_found') }}</div>
      </div>

      <div v-else class="screen-in">
        <div class="brand-top"><BrandLogo :size="52" :show-text="true" /></div>

        <!-- The printable gift card: QR + typeable code + what it is worth. -->
        <div class="gift fc-card" :class="{ dead: v.state !== 'active' }">
          <div class="ribbon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>
            {{ t('vc_gift_title') }}
          </div>

          <div class="center-name">{{ v.center_name }}</div>
          <div v-if="v.recipient_name" class="to">{{ t('vc_to') }} <b>{{ v.recipient_name }}</b></div>

          <div class="worth">{{ durText }}</div>
          <div class="worth-sub">{{ t('vc_one_child') }}</div>

          <div class="qr"><img v-if="qr" :src="qr" alt="QR" width="190" height="190" /></div>
          <div class="code-lbl">{{ t('vc_code') }}</div>
          <div class="code" dir="ltr">{{ v.code }}</div>

          <p v-if="v.note" class="note">{{ v.note }}</p>

          <div class="valid">
            <template v-if="v.expires_on">{{ t('vc_valid_until') }} <span dir="ltr">{{ v.expires_on }}</span></template>
            <template v-else>{{ t('vc_no_expiry') }}</template>
          </div>

          <div v-if="v.state !== 'active'" class="state-banner">{{ t(`vc_state_${v.state}`) }}</div>
          <div v-else class="how">{{ t('vc_how') }}</div>
        </div>

        <button class="fc-btn fc-btn-ghost print-btn" type="button" @click="print">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B5D4C" stroke-width="2.2"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z" /></svg>
          {{ t('pr_print') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import QRCode from 'qrcode';
import BrandLogo from '@/components/BrandLogo.vue';
import { useVouchersStore } from '@/stores/vouchers.js';
import { useUiStore } from '@/stores/ui.js';
import { durationKey } from '@/lib/time.js';

const { t } = useI18n();
const route = useRoute();
const vouchers = useVouchersStore();
const ui = useUiStore();

const loading = ref(true);
const notFound = ref(false);
const v = ref(null);
const qr = ref('');

const durText = computed(() => {
  const min = v.value?.duration_minutes;
  const k = durationKey(min);
  if (k) return t(k);
  return min % 60 === 0 ? t('vc_hours', { n: min / 60 }) : `${min} ${t('mins')}`;
});

function print() { window.print(); }

onMounted(async () => {
  try {
    v.value = await vouchers.publicCard(route.params.token);
    qr.value = await QRCode.toDataURL(v.value.url, {
      margin: 1, width: 190, color: { dark: '#231F1B', light: '#ffffff' },
    });
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.card-wrap { min-height: 100vh; display: flex; justify-content: center; padding: 40px 16px 60px; position: relative; }
.card-shell { width: 100%; max-width: 440px; }
.lang-fab {
  position: absolute; top: 20px; inset-inline-end: 16px; height: 36px; padding: 0 14px;
  border: 2px solid var(--line-4); background: #fff; border-radius: 12px; color: var(--ink);
  font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: var(--shadow-card); z-index: 5;
}
.state { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
.nf-badge { width: 72px; height: 72px; border-radius: 50%; background: #FEEDEC; display: flex; align-items: center; justify-content: center; }
.nf-title { font-family: var(--font-head); font-weight: 800; font-size: 20px; color: var(--ink); text-align: center; }
.brand-top { display: flex; justify-content: center; margin-bottom: 20px; }

.gift {
  background: #fff; padding: 0 22px 24px; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  border: 2px dashed #E4A78E;
}
.ribbon {
  align-self: stretch; margin: 0 -22px 18px; padding: 14px;
  background: linear-gradient(135deg, var(--brand), #EC6A9C); color: #fff;
  font-family: var(--font-head); font-weight: 800; font-size: 20px;
  display: flex; align-items: center; justify-content: center; gap: 10px;
}
.center-name { font-weight: 700; font-size: 15px; color: var(--muted-strong); }
.to { margin-top: 8px; font-size: 16px; color: var(--ink); }
.worth { font-family: var(--font-head); font-weight: 800; font-size: 34px; color: var(--accent); margin-top: 12px; line-height: 1.2; }
.worth-sub { font-size: 13px; color: var(--muted-2); }
.qr { margin-top: 16px; }
.qr img { border: 2px solid var(--line-soft); border-radius: 16px; padding: 10px; background: #fff; display: block; }
.code-lbl { font-size: 12px; color: var(--muted-2); margin-top: 12px; }
.code { font-family: var(--font-head); font-weight: 800; font-size: 26px; color: var(--ink); letter-spacing: 2px; }
.note { margin: 12px 0 0; font-size: 14px; color: var(--muted-strong); white-space: pre-line; overflow-wrap: anywhere; }
.valid { margin-top: 12px; font-size: 13px; color: var(--muted-2); font-weight: 700; }
.how { margin-top: 14px; background: #EAF7F4; color: #0E8C7E; font-size: 13px; line-height: 1.55; padding: 12px 14px; border-radius: 14px; }
.state-banner { margin-top: 14px; background: #FEEDEC; color: var(--over); font-weight: 800; font-size: 15px; padding: 12px 16px; border-radius: 14px; }
.gift.dead .qr, .gift.dead .worth { opacity: .35; }
.print-btn { width: 100%; height: 54px; font-size: 16px; margin-top: 18px; }

@media print {
  .lang-fab, .print-btn { display: none !important; }
  .card-wrap { padding: 0; }
  .gift { box-shadow: none; margin: 0 auto; }
  .ribbon { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
