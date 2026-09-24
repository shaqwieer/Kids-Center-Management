<template>
  <div class="pub-root">
    <button class="lang-fab" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

    <div class="pub-shell wide screen-in">
      <div v-if="loading" class="pub-center"><div class="fc-spin"></div></div>

      <article v-else class="pub-card pub-pad">
        <div class="brand"><BrandLogo :size="46" :show-text="true" /></div>
        <h1 class="pub-h1">{{ t('tm_title') }}</h1>
        <p v-if="terms.center_name" class="pub-sub">{{ terms.center_name }}</p>

        <!-- Written by the centre in Settings. Rendered as TEXT (never v-html,
             never through t()), so whatever the manager types shows verbatim. -->
        <div v-if="body" class="body" :dir="bodyDir">{{ body }}</div>

        <div v-else-if="terms.terms_url" class="empty">
          <a :href="terms.terms_url" target="_blank" rel="noopener noreferrer" class="ext-a">{{ t('rg_terms_link') }}</a>
        </div>

        <p v-else class="empty">{{ t('tm_empty') }}</p>

        <p v-if="body && updated" class="updated">{{ t('tm_updated') }} <span dir="ltr">{{ updated }}</span></p>
      </article>

      <div class="pub-foot">{{ terms.center_name || t('brand') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BrandLogo from '@/components/BrandLogo.vue';
import api from '@/lib/api.js';
import { useUiStore } from '@/stores/ui.js';

const { t, locale } = useI18n();
const ui = useUiStore();

const loading = ref(true);
const terms = ref({ ar: '', en: '', center_name: '', terms_url: null, updated_at: null });

onMounted(async () => {
  try {
    const { data } = await api.get('/public/terms');
    terms.value = data.terms || terms.value;
  } catch {
    // Leave the empty state — a missing page is better than an error wall.
  } finally {
    loading.value = false;
  }
});

// The page follows the language toggle; if the centre only wrote one language,
// show that one rather than an empty page.
const bodyLang = computed(() => {
  const want = locale.value === 'en' ? 'en' : 'ar';
  const other = want === 'en' ? 'ar' : 'en';
  return terms.value[want]?.trim() ? want : other;
});
const body = computed(() => (terms.value[bodyLang.value] || '').trim());
const bodyDir = computed(() => (bodyLang.value === 'ar' ? 'rtl' : 'ltr'));

const updated = computed(() => {
  if (!terms.value.updated_at) return '';
  const d = new Date(terms.value.updated_at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
});
</script>

<style scoped>
.brand { display: flex; justify-content: center; }
.pub-h1 { font-family: var(--font-head); font-weight: 800; font-size: clamp(22px, 5.5vw, 28px); color: var(--ink); margin: 14px 0 0; text-align: center; }
.pub-sub { font-size: 14px; color: var(--muted-2); margin: 6px 0 0; text-align: center; }
.body {
  margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--line-soft);
  white-space: pre-line; overflow-wrap: anywhere;
  font-size: 15px; line-height: 1.9; color: var(--ink); text-align: start;
}
.empty { margin: 26px 0 6px; text-align: center; color: var(--muted-2); font-size: 14.5px; }
.ext-a { color: var(--accent); font-weight: 700; text-decoration: underline; }
.updated { margin: 22px 0 0; font-size: 12px; color: var(--muted-3); text-align: center; }

@media print {
  .lang-fab, .pub-foot { display: none !important; }
}
</style>
