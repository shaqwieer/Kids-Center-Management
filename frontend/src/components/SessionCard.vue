<template>
  <div class="card" :style="{ background: s.bg, borderColor: s.border }">
    <div class="strip" :style="{ background: s.chipBg }">
      <span class="strip-dot" :style="dotStyle"></span>
      <span class="strip-label" :style="{ color: s.color }">{{ stateLabel }}</span>
    </div>

    <div class="who">
      <div class="fc-avatar avatar" :style="{ background: avatarColor(child) }">{{ initial(child) }}</div>
      <div class="who-text">
        <div class="child">{{ child }}</div>
        <div class="mother">{{ t('mother') }}: {{ mother }}</div>
      </div>
    </div>

    <!-- Medical safety: staff must see this without opening anything. -->
    <div v-if="session.child?.has_allergy" class="allergy" :title="session.child.allergy_note || t('allergy_badge')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
        <path d="M12 9v5M12 17.5v.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
      <span class="allergy-t">
        <strong>{{ t('allergy_badge') }}</strong>
        <template v-if="session.child.allergy_note"> · {{ session.child.allergy_note }}</template>
      </span>
    </div>

    <div class="ring-wrap" :class="{ 'is-over': isOvertime }" :style="{ '--glow': s.color }">
      <ProgressRing :frac="ringFrac" :color="s.color" :size="134">
        <div class="cd" :style="{ color: s.color, fontSize: cdSize + 'px' }" dir="ltr">{{ cd.sign }}{{ cd.text }}</div>
        <div class="cd-cap">{{ cd.over ? t('late') : t('timeleft') }}</div>
      </ProgressRing>
    </div>

    <div class="tiles">
      <div class="tile">
        <div class="tile-k">{{ t('duration') }}</div>
        <div class="tile-v">{{ durLabel }}</div>
      </div>
      <div class="tile">
        <div class="tile-k">{{ t('started') }}</div>
        <div class="tile-v" dir="ltr">{{ formatTime(session.started_at, ui.locale) }}</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn ghost" @click="onAddTime">＋ {{ t('add_time') }}</button>
      <button class="btn end" :style="{ background: endBg }" @click="onEnd">{{ t('end_session') }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import ProgressRing from '@/components/ProgressRing.vue';
import { useSessionsStore } from '@/stores/sessions.js';
import { useUiStore } from '@/stores/ui.js';
import { avatarColor, initial, STATE_STYLES } from '@/lib/colors.js';
import { liveState, countdown, progressFraction, formatTime, durationKey } from '@/lib/time.js';

const props = defineProps({ session: { type: Object, required: true } });

const { t } = useI18n();
const router = useRouter();
const sessions = useSessionsStore();
const ui = useUiStore();

const state = computed(() => liveState(props.session.ends_at, sessions.now));
const s = computed(() => STATE_STYLES[state.value]);
const cd = computed(() => countdown(props.session.ends_at, sessions.now));
const frac = computed(() => progressFraction(props.session.started_at, props.session.ends_at, sessions.now));

const isOvertime = computed(() => state.value === 'overtime');
// Overtime has no time "remaining" to draw, so fill the ring solid instead of
// leaving a hollow track — a full red ring reads as "time's up", not broken.
const ringFrac = computed(() => (isOvertime.value ? 1 : frac.value));
// Keep the figure big for the common mm:ss / +mm:ss (≤6 chars) and shrink as the
// h:mm:ss string grows, so a long overtime still fits inside the ring un-clipped.
const cdSize = computed(() => {
  const len = cd.value.sign.length + cd.value.text.length;
  if (len >= 9) return 18; // +hh:mm:ss (10h+; only stale data reaches this)
  if (len >= 8) return 22; // +h:mm:ss  (realistic long overtime)
  if (len >= 7) return 26;
  return 30;               // mm:ss / +mm:ss
});

const child = computed(() => props.session.child.name);
const mother = computed(() => props.session.customer.full_name);

const stateLabel = computed(() => {
  if (state.value === 'warning') return t('st_warning');
  if (state.value === 'overtime') return t('st_overtime');
  return t('st_playing');
});

const durLabel = computed(() => {
  const k = durationKey(props.session.duration_minutes);
  return k ? t(k) : `${props.session.duration_minutes} ${t('mins')}`;
});

const dotStyle = computed(() => ({
  background: s.value.color,
  animation: state.value === 'overtime' ? 'fcPulseRing 1.6s ease-in-out infinite' : 'none',
}));

const endBg = computed(() => (state.value === 'overtime' ? '#E5484D' : '#F97A53'));

async function onAddTime() {
  try {
    await sessions.addTime(props.session.id, 15);
    ui.toast(t('toast_added'), 'success');
  } catch (e) {
    ui.toast(t('error_generic'), 'error');
  }
}

function onEnd() {
  router.push({ name: 'checkout', params: { id: props.session.id } });
}
</script>

<style scoped>
.card {
  border: 2px solid var(--line);
  border-radius: 26px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  box-shadow: 0 16px 32px -20px rgba(60, 40, 20, .42);
  overflow: hidden;
}

.strip {
  margin: -18px -18px 2px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 9px;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
}
.strip-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.strip-label { font-weight: 800; font-size: 13.5px; }

.who { display: flex; align-items: center; gap: 12px; }
.avatar {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  font-size: 24px;
  flex: none;
}
.who-text { flex: 1; min-width: 0; }
.child {
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 20px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mother {
  font-size: 13px;
  color: var(--muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Warning colour + an icon, so it never depends on colour alone. */
.allergy {
  display: flex; align-items: flex-start; gap: 8px;
  background: #FDECEC; border: 1.5px solid #F6C9C9; border-radius: 12px;
  padding: 8px 11px; color: #B4363A;
}
.allergy svg { flex: none; margin-top: 1px; }
.allergy-t { font-size: 12.5px; line-height: 1.45; overflow-wrap: anywhere; }

.ring-wrap { position: relative; display: flex; align-items: center; justify-content: center; padding: 2px 0; }
/* Soft halo behind the ring; only shown (and pulsing) once a session runs over. */
.ring-wrap.is-over::before {
  content: '';
  position: absolute;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  background: var(--glow);
  filter: blur(11px);
  opacity: .18;
  z-index: 0;
  animation: fcRingGlow 1.8s ease-in-out infinite;
}
.ring-wrap :deep(.ring) { position: relative; z-index: 1; }
@keyframes fcRingGlow {
  0%, 100% { transform: scale(.86); opacity: .10; }
  50% { transform: scale(1.08); opacity: .24; }
}
@media (prefers-reduced-motion: reduce) {
  .ring-wrap.is-over::before { animation: none; opacity: .16; }
}
.cd {
  font-family: var(--font-head);
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}
.cd-cap {
  font-size: 12px;
  color: var(--muted-2);
  margin-top: 5px;
  font-weight: 600;
}

.tiles { display: flex; gap: 10px; }
.tile {
  flex: 1;
  background: rgba(255, 255, 255, .7);
  border: 1px solid rgba(0, 0, 0, .06);
  border-radius: 14px;
  padding: 9px 10px;
  text-align: center;
}
.tile-k { font-size: 11px; color: var(--muted-2); font-weight: 600; }
.tile-v { font-size: 15px; font-weight: 700; color: var(--ink); margin-top: 2px; }

.actions { display: flex; gap: 10px; }
.btn {
  flex: 1;
  height: 52px;
  border-radius: 15px;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}
.btn.ghost {
  border: 2px solid var(--line-4);
  background: #fff;
  color: var(--ink);
}
.btn.end {
  border: none;
  color: #fff;
}
</style>
