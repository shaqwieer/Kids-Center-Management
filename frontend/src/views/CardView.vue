<template>
  <div class="card-wrap">
    <button class="lang-fab" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

    <div class="card-shell">
      <!-- loading -->
      <div v-if="loading" class="state">
        <span class="fc-spin"></span>
      </div>

      <!-- not found -->
      <div v-else-if="notFound" class="state screen-in">
        <div class="nf-badge">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
        </div>
        <div class="nf-title">{{ t('error_generic') }}</div>
      </div>

      <!-- card -->
      <div v-else class="screen-in">
        <div class="brand-top">
          <BrandLogo :size="52" :show-text="true" />
        </div>

        <div class="personal-card fc-card">
          <div class="pc-qr">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR" width="200" height="200" />
          </div>

          <div class="pc-name">{{ cust.full_name }}</div>
          <div class="pc-code-lbl">{{ t('rg_your_code') }}</div>
          <div class="pc-code" dir="ltr">{{ cust.customer_code }}</div>

          <div v-if="cust.children && cust.children.length" class="pc-kids">
            <span v-for="k in cust.children" :key="k.id" class="kid-chip">{{ k.name }}</span>
          </div>

          <div class="scan-note">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E8C7E" stroke-width="2.2" class="scan-ic"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
            <span>{{ t('rg_scan_next') }}</span>
          </div>
        </div>

        <button class="fc-btn fc-btn-ghost print-btn" type="button" @click="printCard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B5D4C" stroke-width="2.2"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z" /></svg>
          {{ t('pr_print') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import QRCode from 'qrcode';
import BrandLogo from '@/components/BrandLogo.vue';
import { useCustomersStore } from '@/stores/customers.js';
import { useUiStore } from '@/stores/ui.js';

const { t } = useI18n();
const route = useRoute();
const customers = useCustomersStore();
const ui = useUiStore();

const loading = ref(true);
const notFound = ref(false);
const cust = ref(null);
const qrDataUrl = ref('');

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

onMounted(async () => {
  try {
    const c = await customers.card(route.params.token);
    cust.value = c;
    await genQr(c.card_url);
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
});

function printCard() {
  window.print();
}
</script>

<style scoped>
.card-wrap {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 40px 18px 60px;
  position: relative;
}
.card-shell { width: 100%; max-width: 440px; }

.lang-fab {
  position: absolute;
  top: 20px;
  inset-inline-end: 18px;
  height: 36px;
  padding: 0 14px;
  border: 2px solid var(--line-4);
  background: #fff;
  border-radius: 12px;
  color: var(--ink);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  z-index: 5;
}

.state { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
.nf-badge { width: 72px; height: 72px; border-radius: 50%; background: #FEEDEC; display: flex; align-items: center; justify-content: center; }
.nf-title { font-family: var(--font-head); font-weight: 800; font-size: 20px; color: var(--ink); }

.brand-top { display: flex; justify-content: center; margin-bottom: 20px; }

.personal-card {
  background: #fff;
  padding: 26px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.pc-qr { display: flex; justify-content: center; }
.pc-qr img { border: 2px solid var(--line-soft); border-radius: 16px; padding: 12px; background: #fff; display: block; }
.pc-name { font-weight: 700; font-size: 18px; color: var(--ink); margin-top: 18px; }
.pc-code-lbl { font-size: 12px; color: var(--muted-2); margin-top: 12px; }
.pc-code { font-family: var(--font-head); font-weight: 800; font-size: 26px; color: var(--accent); letter-spacing: 2px; margin-top: 2px; }

.pc-kids { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 16px; }
.kid-chip { background: var(--chip); color: var(--muted-strong); font-weight: 700; font-size: 13px; padding: 6px 12px; border-radius: 999px; }

.scan-note {
  display: inline-flex;
  align-items: flex-start;
  gap: 10px;
  background: #EAF7F4;
  border-radius: 16px;
  padding: 14px 16px;
  margin-top: 20px;
  text-align: start;
}
.scan-ic { flex: none; margin-top: 2px; }
.scan-note span { font-size: 13px; color: #0E8C7E; line-height: 1.55; }

.print-btn { width: 100%; height: 54px; font-size: 16px; margin-top: 18px; }

@media print {
  .lang-fab, .brand-top, .print-btn, .scan-note { display: none !important; }
  .card-wrap { padding: 0; }
  .personal-card { box-shadow: none; border: 1px solid #E4D9C8; margin: 0 auto; }
}
</style>
