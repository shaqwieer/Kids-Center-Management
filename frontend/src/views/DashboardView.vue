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

      <button class="start-btn" @click="router.push({ name: 'start' })">
        <span class="plus">+</span>{{ t('start_new') }}
      </button>
    </div>

    <div class="body">
      <div v-if="sessions.list.length" class="board">
        <!-- Three buckets a child moves through automatically as its timer runs:
             Playing → Ending soon → Time's up. No manual filter; the live state
             (derived from ends_at) decides the column. -->
        <section v-for="col in columns" :key="col.key" class="col" :class="`col-${col.key}`">
          <header class="col-head">
            <span class="col-dot"></span>
            <span class="col-name">{{ t(col.label) }}</span>
            <span class="col-count">{{ col.list.length }}</span>
          </header>
          <div class="col-body">
            <SessionCard v-for="s in col.list" :key="s.id" :session="s" />
            <div v-if="!col.list.length" class="col-empty">—</div>
          </div>
        </section>
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
import { computed, onMounted } from 'vue';
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

// Split the active sessions into the three timeline buckets. A card lives in
// exactly one column and hops to the next as its ends_at is crossed; the store's
// per-second `now` tick re-evaluates this so cards move on their own.
const buckets = computed(() => {
  const now = sessions.now;
  const out = { playing: [], warning: [], overtime: [] };
  for (const s of sessions.list) out[liveState(s.ends_at, now)].push(s);
  const byRemaining = (a, b) => remainingMs(a.ends_at, now) - remainingMs(b.ends_at, now);
  out.playing.sort(byRemaining);
  out.warning.sort(byRemaining);
  out.overtime.sort(byRemaining);
  return out;
});

const columns = computed(() => [
  { key: 'playing', label: 'filter_all', list: buckets.value.playing },
  { key: 'warning', label: 'filter_soon', list: buckets.value.warning },
  { key: 'overtime', label: 'filter_over', list: buckets.value.overtime },
]);

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

/* Three-lane board. Each lane holds the cards for one live state; a card moves
   lane on its own as the countdown crosses the 5-minute and 0-minute marks. */
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  align-items: start;
}
.col {
  background: var(--line-soft);
  border-radius: 22px;
  padding: 12px 12px 16px;
  min-height: 140px;
}
.col-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 8px 12px;
}
.col-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }
.col-playing .col-dot { background: var(--play, #12A594); }
.col-warning .col-dot { background: #F59E0B; }
.col-overtime .col-dot { background: #E5484D; }
.col-name { font-family: var(--font-head); font-weight: 800; font-size: 16px; color: var(--ink); }
.col-count {
  margin-inline-start: auto;
  min-width: 26px;
  text-align: center;
  background: #fff;
  border-radius: 999px;
  padding: 3px 10px;
  font-weight: 800;
  font-size: 13px;
  color: var(--muted-strong);
}
.col-body { display: flex; flex-direction: column; gap: 16px; }
.col-empty { text-align: center; color: var(--muted-3); padding: 22px 0; font-size: 22px; }

/* Stack the lanes on narrow screens so cards never get squeezed below ~300px. */
@media (max-width: 1080px) {
  .board { grid-template-columns: 1fr; gap: 22px; }
  .col { background: transparent; padding: 0; }
  .col-head { padding: 0 2px 10px; border-bottom: 1px solid var(--line-2); margin-bottom: 12px; }
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
