<template>
  <div class="pub-root">
    <button class="lang-fab" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

    <div class="pub-shell screen-in">
      <div v-if="loading" class="pub-center"><div class="fc-spin"></div></div>

      <div v-else-if="notFound" class="pub-card pub-pad center">
        <div class="crest">🙈</div>
        <h1 class="pub-h1">{{ t('error_generic') }}</h1>
      </div>

      <!-- extended just now -->
      <div v-else-if="justExtended" class="pub-card pub-pad center">
        <div class="badge-ok">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 class="pub-h1">{{ t('gx_done') }}</h1>
        <p class="pub-sub">{{ t('gx_done_sub') }}</p>
        <div class="big-clock" dir="ltr">{{ endsAtLabel }}</div>
        <div class="kid-line">{{ s.child_name }}</div>
      </div>

      <div v-else class="pub-card pub-pad">
        <div class="crest">🕐</div>
        <h1 class="pub-h1">{{ s.completed ? t('gx_completed') : t('gx_title') }}</h1>
        <div class="kid-line center">{{ s.child_name }}</div>

        <!-- Live countdown, derived only from the server's ends_at. -->
        <div v-if="!s.completed" class="count" :class="{ over: remainingMs <= 0 }">
          <div class="count-lbl">{{ remainingMs > 0 ? t('gx_remaining') : t('gx_ended') }}</div>
          <div class="count-val" dir="ltr">{{ countdown }}</div>
        </div>

        <div v-if="s.already_added_minutes" class="note-soft">
          {{ t('gx_already', { minutes: s.already_added_minutes }) }}
        </div>

        <template v-if="s.extend_enabled">
          <button class="fc-btn fc-btn-play wide" type="button" :disabled="extending" @click="extend">
            <span v-if="extending" class="fc-spin small"></span>
            <span v-else>{{ s.extend_minutes === 60 ? t('gx_add_hour') : t('gx_add', { minutes: s.extend_minutes }) }}</span>
          </button>
          <p class="price-note">
            {{ t('gx_price_note', { price: s.extend_price, currency: s.currency }) }}
          </p>
        </template>
        <p v-else-if="!s.completed" class="note-soft center">{{ t('gx_disabled') }}</p>
      </div>

      <div class="pub-foot">{{ s?.center_name || t('brand') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/lib/api.js';
import { useUiStore } from '@/stores/ui.js';

const { t } = useI18n();
const route = useRoute();
const ui = useUiStore();

const loading = ref(true);
const notFound = ref(false);
const extending = ref(false);
const justExtended = ref(false);
const s = ref({});
const now = ref(Date.now());
let timer = null;

const remainingMs = computed(() => (s.value.ends_at ? new Date(s.value.ends_at).getTime() - now.value : 0));

const countdown = computed(() => {
  const ms = Math.abs(remainingMs.value);
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  const sign = remainingMs.value < 0 ? '+' : '';
  return `${sign}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
});

const endsAtLabel = computed(() => {
  if (!s.value.ends_at) return '';
  return new Date(s.value.ends_at).toLocaleTimeString(ui.locale === 'ar' ? 'ar-SA' : 'en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh',
  });
});

async function load() {
  try {
    const { data } = await api.get(`/public/session/${route.params.token}`);
    s.value = data.session;
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
}

async function extend() {
  if (extending.value) return;
  extending.value = true;
  try {
    const { data } = await api.post(`/public/session/${route.params.token}/extend`);
    s.value = { ...s.value, ends_at: data.session.ends_at };
    justExtended.value = true;
  } catch (err) {
    ui.toast(err?.response?.data?.error?.message || t('error_generic'), 'error');
  } finally {
    extending.value = false;
  }
}

onMounted(() => {
  load();
  timer = setInterval(() => { now.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped>
.crest { font-size: 44px; text-align: center; line-height: 1; }
.pub-h1 { font-family: var(--font-head); font-weight: 800; font-size: clamp(21px, 5.5vw, 27px); color: var(--ink); margin: 14px 0 0; text-align: center; }
.pub-sub { font-size: 14.5px; color: var(--muted-2); margin: 8px 0 0; text-align: center; }
.kid-line { font-weight: 700; font-size: 17px; color: var(--accent); margin-top: 6px; text-align: center; }

.count {
  margin: 22px 0 0; padding: 20px 16px; border-radius: var(--r-lg);
  background: #EAF7F4; text-align: center;
}
.count.over { background: #FDECEC; }
.count-lbl { font-size: 13px; font-weight: 700; color: #0E8C7E; }
.count.over .count-lbl { color: var(--over); }
.count-val { font-family: var(--font-head); font-weight: 800; font-size: clamp(40px, 14vw, 56px); line-height: 1.1; color: #0E8C7E; }
.count.over .count-val { color: var(--over); }

.big-clock { font-family: var(--font-head); font-weight: 800; font-size: clamp(34px, 12vw, 46px); color: var(--play); margin-top: 14px; }
.note-soft { margin-top: 14px; font-size: 13px; color: var(--muted-2); background: var(--chip); padding: 10px 14px; border-radius: 12px; }
.wide { width: 100%; height: 56px; margin-top: 20px; font-size: 17px; }
.price-note { text-align: center; font-size: 13px; color: var(--muted-2); margin: 10px 0 0; }
.fc-spin.small { width: 22px; height: 22px; border-width: 3px; }
</style>
