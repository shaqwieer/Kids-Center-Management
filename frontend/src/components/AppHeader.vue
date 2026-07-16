<template>
  <header class="hdr">
    <BrandLogo :size="46" class="brand-text-hide" />

    <nav class="nav">
      <button :class="navClass('home')" @click="go('dashboard')">{{ t('nav_home') }}</button>
      <button :class="navClass('customers')" @click="go('customers')">{{ t('nav_customers') }}</button>
      <button :class="navClass('finance')" @click="go('finance')">{{ t('nav_finance') }}</button>
      <button v-if="auth.isManager" :class="navClass('team')" @click="go('team')">{{ t('nav_team') }}</button>
      <button :class="navClass('settings')" @click="go('settings')">{{ t('nav_settings') }}</button>
    </nav>

    <div class="spacer"></div>

    <button class="ghost reg" :title="t('register_cta')" :aria-label="t('register_cta')" @click="go('register')">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F97A53" stroke-width="2.2" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M20 14v.01M20 20v.01M17 20v.01" />
      </svg>
      <span class="reg-lbl">{{ t('register_cta') }}</span>
    </button>

    <div class="clock">
      <div class="time">{{ clock }}</div>
      <div class="date">{{ dateStr }}</div>
    </div>

    <button class="ghost" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

    <div v-if="auth.user" class="me">
      <div class="fc-avatar me-av" :style="{ background: avatarColor(auth.user.name) }">{{ initial(auth.user.name) }}</div>
      <div class="me-meta">
        <div class="me-name">{{ auth.user.name }}</div>
        <div class="me-role">{{ auth.isManager ? t('tm_role_manager') : t('tm_role_staff') }}</div>
      </div>
    </div>

    <button class="ghost logout" :title="t('logout')" :aria-label="t('logout')" @click="logout">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
    </button>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BrandLogo from '@/components/BrandLogo.vue';
import { useUiStore } from '@/stores/ui.js';
import { useAuthStore } from '@/stores/auth.js';
import { formatTime, dateLabel } from '@/lib/time.js';
import { avatarColor, initial } from '@/lib/colors.js';

const { t } = useI18n();
const ui = useUiStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const now = ref(Date.now());
let timer = null;
onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 1000); });
onBeforeUnmount(() => clearInterval(timer));

const clock = computed(() => formatTime(now.value, ui.locale, ui.clock24));
const dateStr = computed(() => dateLabel(ui.locale, now.value));

const GROUPS = {
  home: ['dashboard', 'start', 'checkout'],
  customers: ['customers', 'customer'],
  finance: ['finance'],
  team: ['team'],
  settings: ['settings'],
};
function navClass(group) {
  return ['nav-btn', GROUPS[group].includes(route.name) ? 'on' : ''];
}
function go(name) { router.push({ name }); }
function logout() { auth.logout(); router.push({ name: 'login' }); }
</script>

<style scoped>
.hdr {
  display: flex; align-items: center; gap: 12px;
  height: 74px; padding: 0 24px;
  background: var(--surface-2); border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 20;
}
.nav { display: flex; gap: 4px; margin-inline-start: 12px; }
.nav-btn {
  height: 44px; padding: 0 16px; border-radius: 13px; border: none; cursor: pointer;
  font-weight: 700; font-size: 15px; background: transparent; color: var(--muted);
  transition: background .15s ease, color .15s ease;
}
.nav-btn:hover { color: var(--ink); }
.nav-btn.on { background: var(--ink); color: #fff; }
.spacer { flex: 1; }
.ghost {
  display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 14px;
  border: 2px solid var(--line-4); background: #fff; border-radius: 13px;
  color: var(--ink); font-weight: 700; font-size: 14px; cursor: pointer;
}
.ghost:hover { border-color: var(--brand); }
.reg svg { flex: none; }
.logout { padding: 0 12px; color: var(--muted-strong); }
.clock { display: flex; flex-direction: column; align-items: center; line-height: 1.15; padding: 0 4px; }
.time { font-family: var(--font-head); font-weight: 700; font-size: 17px; color: var(--ink); }
.date { font-size: 10.5px; color: var(--muted-3); }

/* Signed-in identity: which account is acting, and with what powers. */
.me { display: flex; align-items: center; gap: 9px; padding-inline-start: 4px; }
.me-av { width: 36px; height: 36px; border-radius: 11px; font-size: 15px; }
.me-meta { line-height: 1.2; min-width: 0; }
.me-name { font-weight: 700; font-size: 13px; color: var(--ink); max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.me-role { font-size: 10.5px; color: var(--muted-3); }

/* The header is a single row of fixed-size controls, so it sheds the least
   useful ones as it narrows rather than overflowing (in RTL the overflow
   pushes Log out off-screen entirely). */
@media (max-width: 1180px) {
  .me-meta { display: none; }
}
@media (max-width: 1020px) {
  .clock { display: none; }
}
@media (max-width: 940px) {
  .me { display: none; }
}
@media (max-width: 860px) {
  .reg-lbl { display: none; }
  .reg { padding: 0 12px; }
  .nav-btn { padding: 0 11px; font-size: 14px; }
}
/* Below this the wordmark costs more room than it earns; the tile still brands. */
@media (max-width: 880px) {
  .brand-text-hide :deep(.name), .brand-text-hide :deep(.tag) { display: none; }
}
@media (max-width: 720px) {
  .hdr { padding: 0 12px; gap: 8px; }
  .nav { margin-inline-start: 0; gap: 2px; }
  .nav-btn { padding: 0 8px; font-size: 13px; }
}
</style>
