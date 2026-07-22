<template>
  <header class="hdr">
    <!-- Phones get a drawer instead of an overflowing row of tabs. -->
    <button class="burger" :aria-label="t('menu')" :aria-expanded="open" @click="open = true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>

    <BrandLogo :size="46" class="brand-text-hide" />

    <nav class="nav">
      <button v-for="item in navItems" :key="item.group" :class="navClass(item.group)" @click="go(item.route)">
        {{ t(item.label) }}
      </button>
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

    <button class="ghost lang-btn" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

    <div v-if="auth.user" class="me">
      <div class="fc-avatar me-av" :style="{ background: avatarColor(auth.user.name) }">{{ initial(auth.user.name) }}</div>
      <div class="me-meta">
        <div class="me-name">{{ auth.user.name }}</div>
        <div class="me-role">{{ roleLabel }}</div>
      </div>
    </div>

    <button class="ghost logout" :title="t('logout')" :aria-label="t('logout')" @click="logout">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
    </button>
  </header>

  <!-- ------------------------- mobile drawer ------------------------- -->
  <Teleport to="body">
    <div v-if="open" class="drawer-scrim" @click="open = false"></div>
    <aside v-if="open" class="drawer" role="dialog" :aria-label="t('menu')">
      <div class="drawer-top">
        <BrandLogo :size="40" :show-text="true" />
        <button class="drawer-x" :aria-label="t('close')" @click="open = false">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div v-if="auth.user" class="drawer-me">
        <div class="fc-avatar dm-av" :style="{ background: avatarColor(auth.user.name) }">{{ initial(auth.user.name) }}</div>
        <div>
          <div class="dm-name">{{ auth.user.name }}</div>
          <div class="dm-role">{{ roleLabel }}</div>
        </div>
      </div>

      <nav class="drawer-nav">
        <button
          v-for="item in navItems"
          :key="item.group"
          class="drawer-item"
          :class="{ on: GROUPS[item.group].includes(route.name) }"
          @click="go(item.route)"
        >{{ t(item.label) }}</button>
        <button class="drawer-item" @click="go('register')">{{ t('register_cta') }}</button>
      </nav>

      <div class="drawer-foot">
        <button class="fc-btn fc-btn-ghost dfull" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>
        <button class="fc-btn fc-btn-ghost dfull" @click="logout">{{ t('logout') }}</button>
      </div>
    </aside>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
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

const open = ref(false);

const now = ref(Date.now());
let timer = null;
onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 1000); });
onBeforeUnmount(() => clearInterval(timer));

const clock = computed(() => formatTime(now.value, ui.locale, ui.clock24));
const dateStr = computed(() => dateLabel(ui.locale, now.value));

const roleLabel = computed(() => (auth.isManager ? t('tm_role_manager') : t('tm_role_reception')));

const GROUPS = {
  home: ['dashboard', 'start', 'checkout'],
  customers: ['customers', 'customer'],
  bookings: ['bookings'],
  finance: ['finance'],
  insights: ['insights'],
  team: ['team'],
  settings: ['settings'],
};

/**
 * Reception sees only what it can act on. Finance, insights and the team page
 * are manager-only (and the router + API refuse them regardless of this list).
 */
const navItems = computed(() => {
  const items = [
    { group: 'home', route: 'dashboard', label: 'nav_home' },
    { group: 'customers', route: 'customers', label: 'nav_customers' },
    { group: 'bookings', route: 'bookings', label: 'nav_bookings' },
  ];
  if (auth.isManager) {
    items.push(
      { group: 'insights', route: 'insights', label: 'nav_insights' },
      { group: 'finance', route: 'finance', label: 'nav_finance' },
      { group: 'team', route: 'team', label: 'nav_team' },
    );
  }
  items.push({ group: 'settings', route: 'settings', label: 'nav_settings' });
  return items;
});

function navClass(group) {
  return ['nav-btn', GROUPS[group].includes(route.name) ? 'on' : ''];
}
function go(name) {
  open.value = false;
  router.push({ name });
}
function logout() {
  open.value = false;
  auth.logout();
  router.push({ name: 'login' });
}

// A drawer that stays open while the page behind it scrolls feels broken.
watch(open, (v) => { document.body.style.overflow = v ? 'hidden' : ''; });
onBeforeUnmount(() => { document.body.style.overflow = ''; });
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
  height: 44px; padding: 0 15px; border-radius: 13px; border: none; cursor: pointer;
  font-weight: 700; font-size: 15px; background: transparent; color: var(--muted);
  transition: background .15s ease, color .15s ease; white-space: nowrap;
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

.me { display: flex; align-items: center; gap: 9px; padding-inline-start: 4px; }
.me-av { width: 36px; height: 36px; border-radius: 11px; font-size: 15px; }
.me-meta { line-height: 1.2; min-width: 0; }
.me-name { font-weight: 700; font-size: 13px; color: var(--ink); max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.me-role { font-size: 10.5px; color: var(--muted-3); }

.burger {
  display: none; width: 44px; height: 44px; flex: none;
  align-items: center; justify-content: center;
  border: 2px solid var(--line-4); background: #fff; border-radius: 13px;
  color: var(--ink); cursor: pointer;
}

/* The header sheds low-value controls as it narrows. A manager now has seven
   nav items with long Arabic labels, so the ladder starts much higher than it
   used to — at 1024px the old thresholds overflowed the row off the LEFT edge
   (RTL), which is exactly the "doesn't open properly" symptom. */
@media (max-width: 1440px) { .me-meta { display: none; } }
@media (max-width: 1340px) { .clock { display: none; } }
@media (max-width: 1260px) { .reg-lbl { display: none; } .reg { padding: 0 12px; } }
@media (max-width: 1200px) { .me { display: none; } }
@media (max-width: 1150px) { .brand-text-hide :deep(.name), .brand-text-hide :deep(.tag) { display: none; } }

/* ...and below this the tab row can no longer fit at all, so it becomes a
   drawer. Seven nav items simply do not survive a phone viewport, and squeezing
   them was what pushed Log out off-screen in RTL. */
@media (max-width: 1080px) {
  .hdr { padding: 0 12px; gap: 8px; height: 66px; }
  .burger { display: inline-flex; }
  .nav, .reg, .lang-btn { display: none; }
}

/* ---------------------------- drawer ---------------------------- */
.drawer-scrim {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(44, 38, 32, .5); backdrop-filter: blur(2px);
  animation: fcScreenIn .2s ease;
}
.drawer {
  position: fixed; inset-block: 0; inset-inline-start: 0; z-index: 61;
  width: min(300px, 84vw); display: flex; flex-direction: column;
  background: var(--surface-2); border-inline-end: 1px solid var(--line);
  padding: 16px; overflow-y: auto;
}
.drawer-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.drawer-x {
  width: 40px; height: 40px; flex: none; border-radius: 12px;
  border: 2px solid var(--line-4); background: #fff; color: var(--muted-strong); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.drawer-me { display: flex; align-items: center; gap: 11px; margin-top: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.dm-av { width: 42px; height: 42px; border-radius: 13px; font-size: 17px; }
.dm-name { font-weight: 700; font-size: 15px; color: var(--ink); }
.dm-role { font-size: 12px; color: var(--muted-3); }
.drawer-nav { display: flex; flex-direction: column; gap: 4px; margin-top: 14px; flex: 1; }
.drawer-item {
  height: 50px; padding: 0 15px; border-radius: 13px; border: none; cursor: pointer;
  background: transparent; color: var(--muted-strong);
  font-family: var(--font-body); font-weight: 700; font-size: 15.5px; text-align: start;
}
.drawer-item.on { background: var(--ink); color: #fff; }
.drawer-foot { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.dfull { width: 100%; height: 46px; }
</style>
