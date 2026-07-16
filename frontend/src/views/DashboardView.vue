<template>
  <div class="screen-in dash">
    <div class="topbar">
      <div class="head">
        <div class="title">{{ t('dash_title') }}</div>
        <div class="pill">
          <span class="pill-dot"></span>
          <b>{{ sessions.activeCount }}</b>&nbsp;{{ t('children_playing') }}
        </div>
      </div>

      <div class="seg">
        <button :class="{ active: filter === 'all' }" @click="filter = 'all'">{{ t('filter_all') }}</button>
        <button :class="{ active: filter === 'soon' }" @click="filter = 'soon'">{{ t('filter_soon') }}</button>
        <button :class="{ active: filter === 'over' }" @click="filter = 'over'">{{ t('filter_over') }}</button>
      </div>

      <button class="start-btn" @click="router.push({ name: 'start' })">
        <span class="plus">+</span>{{ t('start_new') }}
      </button>
    </div>

    <div class="body">
      <div v-if="cards.length" class="grid">
        <SessionCard v-for="s in cards" :key="s.id" :session="s" />
      </div>

      <div v-else class="empty">
        <div class="empty-icon">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#C6B49A" stroke-width="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
        <div class="empty-title">{{ t('empty_title') }}</div>
        <div class="empty-sub">{{ t('empty_sub') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import SessionCard from '@/components/SessionCard.vue';
import { useSessionsStore } from '@/stores/sessions.js';
import { useUiStore } from '@/stores/ui.js';
import { liveState, remainingMs } from '@/lib/time.js';

const { t } = useI18n();
const router = useRouter();
const sessions = useSessionsStore();
const ui = useUiStore();

const filter = ref('all');

const ORDER = { overtime: 0, warning: 1, playing: 2 };

const cards = computed(() => {
  const now = sessions.now;
  let list = sessions.list.slice();

  if (filter.value === 'soon') {
    list = list.filter((s) => liveState(s.ends_at, now) === 'warning');
  } else if (filter.value === 'over') {
    list = list.filter((s) => liveState(s.ends_at, now) === 'overtime');
  }

  list.sort((a, b) => {
    const sa = liveState(a.ends_at, now);
    const sb = liveState(b.ends_at, now);
    if (ORDER[sa] !== ORDER[sb]) return ORDER[sa] - ORDER[sb];
    return remainingMs(a.ends_at, now) - remainingMs(b.ends_at, now);
  });

  return list;
});

onMounted(async () => {
  try {
    await sessions.fetchActive();
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
  }
});
</script>

<style scoped>
.dash { padding: 0; }

.topbar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px 28px 14px;
}
.head { flex: 1; min-width: 0; }
.title {
  font-family: var(--font-head);
  font-size: 30px;
  font-weight: 800;
  color: var(--ink);
  line-height: 1.05;
}
.pill {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #EAF7F4;
  color: #0E8C7E;
  padding: 5px 13px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
}
.pill b { font-size: 15px; }
.pill-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--play);
  box-shadow: 0 0 0 4px rgba(18, 165, 148, .18);
}

.seg {
  display: flex;
  gap: 4px;
  background: var(--line-2);
  padding: 5px;
  border-radius: 16px;
  flex: none;
}
.seg button {
  border: none;
  background: transparent;
  padding: 9px 16px;
  border-radius: 12px;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 14px;
  color: var(--muted-strong);
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.seg button.active {
  background: #fff;
  color: var(--ink);
  box-shadow: 0 4px 10px -6px rgba(60, 40, 20, .42);
}

.start-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 58px;
  padding: 0 24px;
  border: none;
  border-radius: 18px;
  background: var(--brand);
  color: #fff;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 18px;
  cursor: pointer;
  flex: none;
  box-shadow: 0 12px 24px -8px rgba(249, 122, 83, .72);
}
.start-btn .plus { font-size: 26px; line-height: 1; margin-top: -2px; }

.body { padding: 8px 32px 60px; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 70px 20px;
  text-align: center;
}
.empty-icon {
  width: 96px;
  height: 96px;
  border-radius: 30px;
  background: var(--line-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}
.empty-title {
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 21px;
  color: var(--muted-strong);
}
.empty-sub {
  font-size: 14px;
  color: var(--muted-3);
  margin-top: 6px;
}
</style>
