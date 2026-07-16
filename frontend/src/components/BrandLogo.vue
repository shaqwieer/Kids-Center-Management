<template>
  <div class="brand" :class="`tone-${tone}`" :style="{ gap: showText ? '12px' : '0' }">
    <div class="mark" :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.52 + 'px', borderRadius: size * 0.32 + 'px' }">
      {{ isAr ? 'ف' : 'F' }}
    </div>
    <div v-if="showText">
      <div class="name">{{ t('brand') }}</div>
      <div class="tag">{{ t('tagline') }}</div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useUiStore } from '@/stores/ui.js';
import { storeToRefs } from 'pinia';

defineProps({
  size: { type: Number, default: 46 },
  showText: { type: Boolean, default: true },
  // 'ink' reads on cream/white; 'inverse' reads on the brand gradient.
  tone: { type: String, default: 'ink' },
});
const { t } = useI18n();
const { isAr } = storeToRefs(useUiStore());
</script>

<style scoped>
.brand { display: flex; align-items: center; }
.mark {
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-head); font-weight: 800; flex: none;
}
.name { font-family: var(--font-head); font-weight: 800; font-size: 19px; line-height: 1; white-space: nowrap; }
.tag { font-size: 11px; margin-top: 3px; white-space: nowrap; }

.tone-ink .mark {
  background: linear-gradient(135deg, #F97A53, #F5A623);
  color: #fff;
  box-shadow: 0 8px 16px -6px rgba(249, 122, 83, .7);
}
.tone-ink .name { color: var(--ink); }
.tone-ink .tag { color: var(--muted-3); }

/* On the brand gradient the orange tile would disappear, so it flips to white. */
.tone-inverse .mark {
  background: #fff;
  color: var(--accent);
  box-shadow: 0 10px 22px -8px rgba(120, 50, 20, .45);
}
.tone-inverse .name { color: #fff; }
.tone-inverse .tag { color: rgba(255, 255, 255, .82); }
</style>
