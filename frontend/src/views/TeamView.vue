<template>
  <div class="team-root screen-in">
    <!-- Page head -->
    <header class="page-head">
      <div class="ph-text">
        <h1 class="ph-title">{{ t('tm_title') }}</h1>
        <p class="ph-sub">{{ t('tm_sub') }}</p>
      </div>
      <button class="fc-btn fc-btn-primary add-btn" @click="openCreate">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {{ t('tm_add') }}
      </button>
    </header>

    <div v-if="users.loading && !users.list.length" class="loading-pane">
      <div class="fc-spin"></div>
    </div>

    <template v-else>
      <!-- One group per role: the role IS the access level, so it organises the page. -->
      <section v-for="g in groups" :key="g.role" class="role-group">
        <div class="rg-head" :class="`rg-${g.role}`">
          <span class="rg-dot"></span>
          <h2 class="rg-title">{{ t(g.titleKey) }}</h2>
          <span class="rg-count" dir="ltr">{{ g.rows.length }}</span>
          <p class="rg-hint">{{ t(g.hintKey) }}</p>
        </div>

        <ul v-if="g.rows.length" class="cards">
          <li v-for="u in g.rows" :key="u.id" class="card" :class="`card-${g.role}`">
            <div class="fc-avatar av" :style="{ background: avatarColor(u.name) }">{{ initial(u.name) }}</div>

            <div class="meta">
              <div class="name-row">
                <span class="name">{{ u.name }}</span>
                <span v-if="u.id === auth.user?.id" class="you">{{ t('tm_you') }}</span>
              </div>
              <div class="email" dir="ltr">{{ u.email }}</div>
              <div class="joined">{{ t('tm_joined') }} {{ formatDate(u.created_at, ui.locale) }}</div>
            </div>

            <div class="actions">
              <button class="icon-btn" :title="t('tm_edit_title')" :aria-label="`${t('tm_edit_title')} — ${u.name}`" @click="openEdit(u)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </button>
              <button class="icon-btn danger" :title="t('tm_delete_confirm')" :aria-label="`${t('tm_delete_confirm')} — ${u.name}`" @click="askDelete(u)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
                </svg>
              </button>
            </div>
          </li>
        </ul>

        <p v-else class="rg-empty">{{ t('tm_empty_sub') }}</p>
      </section>
    </template>

    <!-- ============================ CREATE / EDIT ============================ -->
    <div v-if="form" class="scrim" @click.self="closeForm">
      <div class="sheet fc-card" role="dialog" aria-modal="true" :aria-label="form.id ? t('tm_edit_title') : t('tm_new_title')">
        <div class="sheet-head">
          <h2 class="sheet-title">{{ form.id ? t('tm_edit_title') : t('tm_new_title') }}</h2>
          <button class="icon-btn" :aria-label="t('close')" @click="closeForm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form class="sheet-body" @submit.prevent="save">
          <div class="field">
            <label class="lbl" for="tm-name">{{ t('tm_name') }}</label>
            <input id="tm-name" ref="firstField" v-model="form.name" class="fc-input" autocomplete="off" />
          </div>

          <div class="field">
            <label class="lbl" for="tm-email">{{ t('tm_email') }}</label>
            <input id="tm-email" v-model="form.email" class="fc-input" type="email" dir="ltr" autocomplete="off" />
          </div>

          <div class="field">
            <label class="lbl" for="tm-pw">{{ t('tm_password') }}</label>
            <div class="pw-wrap">
              <input
                id="tm-pw"
                v-model="form.password"
                class="fc-input"
                :type="showPw ? 'text' : 'password'"
                dir="ltr"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="pw-toggle"
                :aria-label="showPw ? t('login_hide_pw') : t('login_show_pw')"
                @click="showPw = !showPw"
              >
                <svg v-if="!showPw" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M17.9 17.9A10.4 10.4 0 0 1 12 19C5 19 1 12 1 12a18.6 18.6 0 0 1 5.1-5.9m3.9-1.9A10.4 10.4 0 0 1 12 5c7 0 11 7 11 7a18.7 18.7 0 0 1-2.2 3.2M1 1l22 22" />
                </svg>
              </button>
            </div>
            <p class="hint">{{ form.id ? t('tm_password_keep') : t('tm_password_hint') }}</p>
          </div>

          <div class="field">
            <span class="lbl">{{ t('tm_role') }}</span>
            <div class="roles">
              <button
                v-for="r in ROLE_OPTS"
                :key="r.role"
                type="button"
                class="role-opt"
                :class="[`opt-${r.role}`, { on: form.role === r.role }]"
                :aria-pressed="form.role === r.role"
                @click="form.role = r.role"
              >
                <span class="opt-name">{{ t(r.titleKey) }}</span>
                <span class="opt-hint">{{ t(r.hintKey) }}</span>
              </button>
            </div>
          </div>

          <p v-if="formError" class="err" role="alert">{{ t(formError) }}</p>
        </form>

        <div class="sheet-foot">
          <button class="fc-btn fc-btn-ghost" type="button" @click="closeForm">{{ t('pr_cancel') }}</button>
          <button class="fc-btn fc-btn-primary grow" type="button" :disabled="!canSave || saving" @click="save">
            <span v-if="saving" class="fc-spin small"></span>
            <span v-else>{{ form.id ? t('tm_save') : t('tm_create') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ============================ DELETE ============================ -->
    <div v-if="doomed" class="scrim" @click.self="doomed = null">
      <div class="sheet sheet-sm fc-card" role="alertdialog" aria-modal="true" :aria-label="t('tm_delete_confirm')">
        <div class="sheet-body danger-body">
          <div class="warn-badge">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
            </svg>
          </div>
          <h2 class="del-title">{{ t('tm_delete_q', { name: doomed.name }) }}</h2>
          <p class="del-note">{{ t('tm_delete_note') }}</p>
          <p v-if="delError" class="err" role="alert">{{ t(delError) }}</p>
        </div>
        <div class="sheet-foot">
          <button class="fc-btn fc-btn-ghost" type="button" @click="doomed = null">{{ t('pr_cancel') }}</button>
          <button class="fc-btn fc-btn-danger grow" type="button" :disabled="deleting" @click="confirmDelete">
            <span v-if="deleting" class="fc-spin small"></span>
            <span v-else>{{ t('tm_delete_confirm') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref, computed, onMounted, onBeforeUnmount, nextTick,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useUsersStore } from '@/stores/users.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { avatarColor, initial } from '@/lib/colors.js';
import { formatDate } from '@/lib/time.js';
import { teamErrorKey } from '@/lib/api.js';

const { t } = useI18n();
const users = useUsersStore();
const auth = useAuthStore();
const ui = useUiStore();

const ROLE_OPTS = [
  { role: 'manager', titleKey: 'tm_role_manager', hintKey: 'tm_role_manager_hint' },
  { role: 'staff', titleKey: 'tm_role_staff', hintKey: 'tm_role_staff_hint' },
];

const form = ref(null);
const firstField = ref(null);
const showPw = ref(false);
const saving = ref(false);
const formError = ref('');

const doomed = ref(null);
const deleting = ref(false);
const delError = ref('');

const groups = computed(() => [
  { role: 'manager', titleKey: 'tm_managers', hintKey: 'tm_role_manager_hint', rows: users.managers },
  { role: 'staff', titleKey: 'tm_staff_group', hintKey: 'tm_role_staff_hint', rows: users.staff },
]);

const canSave = computed(() => {
  const f = form.value;
  if (!f) return false;
  const base = f.name.trim().length >= 2 && /.+@.+\..+/.test(f.email.trim());
  // Password is required for a new account, optional when editing an existing one.
  return base && (f.id ? (!f.password || f.password.length >= 6) : f.password.length >= 6);
});

function openCreate() {
  formError.value = '';
  showPw.value = false;
  form.value = { id: null, name: '', email: '', password: '', role: 'staff' };
  nextTick(() => firstField.value?.focus());
}

function openEdit(u) {
  formError.value = '';
  showPw.value = false;
  form.value = { id: u.id, name: u.name, email: u.email, password: '', role: u.role };
  nextTick(() => firstField.value?.focus());
}

function closeForm() { form.value = null; }

async function save() {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  formError.value = '';
  const f = form.value;
  try {
    if (f.id) {
      const patch = { name: f.name.trim(), email: f.email.trim(), role: f.role };
      if (f.password) patch.password = f.password;
      await users.update(f.id, patch);
      // Keep the header/greeting truthful if a manager edited their own account.
      if (f.id === auth.user?.id) await auth.fetchMe();
      ui.toast(t('tm_updated'), 'success');
    } else {
      await users.create({
        name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role,
      });
      ui.toast(t('tm_created'), 'success');
    }
    form.value = null;
  } catch (e) {
    formError.value = teamErrorKey(e);
  } finally {
    saving.value = false;
  }
}

function askDelete(u) {
  delError.value = '';
  doomed.value = u;
}

async function confirmDelete() {
  if (deleting.value) return;
  deleting.value = true;
  delError.value = '';
  try {
    await users.remove(doomed.value.id);
    ui.toast(t('tm_deleted'), 'success');
    doomed.value = null;
  } catch (e) {
    delError.value = teamErrorKey(e);
  } finally {
    deleting.value = false;
  }
}

function onKey(e) {
  if (e.key !== 'Escape') return;
  if (form.value) closeForm();
  else if (doomed.value) doomed.value = null;
}

onMounted(async () => {
  window.addEventListener('keydown', onKey);
  try {
    await users.fetch();
  } catch {
    ui.toast(t('error_generic'), 'error');
  }
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
/* width:100% is load-bearing: .app-root is a column flex container, and the
   auto side margins would otherwise suppress the stretch and shrink-wrap this
   page to its content width. */
.team-root { width: 100%; max-width: 1080px; margin: 0 auto; padding: 26px 24px 60px; }

/* ---- page head ---- */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 26px; }
.ph-title { font-family: var(--font-head); font-weight: 800; font-size: 27px; color: var(--ink); margin: 0; }
.ph-sub { font-size: 14px; color: var(--muted-2); margin: 4px 0 0; }
.add-btn { height: 48px; padding: 0 20px; flex: none; }

.loading-pane { display: flex; justify-content: center; padding: 80px 0; }

/* ---- role group ---- */
.role-group { margin-bottom: 30px; }
.rg-head {
  display: grid;
  grid-template-columns: auto auto auto 1fr;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.rg-manager { --rg-color: var(--brand); --rg-soft: #FCE1D4; }
.rg-staff { --rg-color: var(--play); --rg-soft: #DCF0EC; }
.rg-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--rg-color); }
.rg-title { font-family: var(--font-head); font-weight: 800; font-size: 17px; color: var(--ink); margin: 0; }
.rg-count {
  background: var(--rg-soft); color: var(--rg-color);
  font-weight: 800; font-size: 12px; padding: 2px 9px; border-radius: 999px;
}
/* Sits right beside the count — stretched to the far edge it reads as
   unrelated floating text. */
.rg-hint { font-size: 12.5px; color: var(--muted-3); margin: 0; padding-inline-start: 4px; }
.rg-empty { font-size: 13.5px; color: var(--muted-3); margin: 0; }

/* ---- cards ---- */
/* Two account cards per row on a wide screen — three would leave each one
   too narrow for a name + email. */
.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 12px; }
.card {
  display: flex; align-items: center; gap: 14px;
  background: var(--surface); border: 2px solid var(--line-2);
  border-radius: var(--r-lg); padding: 14px 16px;
  transition: border-color .15s ease, transform .12s ease, box-shadow .15s ease;
}
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
.card-manager:hover { border-color: #F4C4AF; }
.card-staff:hover { border-color: #A9DDD5; }
.av { width: 46px; height: 46px; border-radius: 15px; font-size: 19px; }
.meta { min-width: 0; flex: 1; }
.name-row { display: flex; align-items: center; gap: 7px; }
.name { font-weight: 700; font-size: 15.5px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.you { background: var(--chip); color: var(--muted-strong); font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; flex: none; }
.email { font-size: 12.5px; color: var(--muted-2); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.joined { font-size: 11.5px; color: var(--muted-3); margin-top: 3px; }

.actions { display: flex; gap: 6px; flex: none; }
.icon-btn {
  width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid var(--line-3); background: #fff; border-radius: 11px;
  color: var(--muted-strong); cursor: pointer;
  transition: border-color .15s ease, color .15s ease, background .15s ease;
}
.icon-btn:hover { border-color: var(--brand); color: var(--accent); }
.icon-btn.danger:hover { border-color: var(--over); color: var(--over); background: #FEEDEC; }

/* ---- sheets ---- */
.scrim {
  position: fixed; inset: 0; z-index: 40;
  background: rgba(44, 38, 32, .44);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: fcScreenIn .18s ease;
}
.sheet { width: 100%; max-width: 480px; background: #fff; overflow: hidden; max-height: 92vh; display: flex; flex-direction: column; }
.sheet-sm { max-width: 400px; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--line); }
.sheet-title { font-family: var(--font-head); font-weight: 800; font-size: 19px; color: var(--ink); margin: 0; }
.sheet-body { padding: 20px; overflow-y: auto; }
.sheet-foot { display: flex; gap: 10px; padding: 16px 20px; border-top: 1px solid var(--line); background: var(--surface-2); }
.sheet-foot .fc-btn { height: 48px; padding: 0 18px; }
.grow { flex: 1; }

.field { margin-bottom: 16px; }
.lbl { display: block; font-size: 13px; font-weight: 700; color: var(--muted-strong); margin-bottom: 6px; }
.hint { font-size: 12px; color: var(--muted-3); margin: 6px 0 0; }

/* The password field is always dir="ltr", so the toggle is pinned physically
   right — logical props would flip it onto the text in Arabic. */
.pw-wrap { position: relative; }
.pw-wrap .fc-input { padding-right: 46px; }
.pw-toggle {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;
  border: none; background: none; color: var(--muted-2); cursor: pointer; border-radius: 9px;
}
.pw-toggle:hover { color: var(--ink); }

.roles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.role-opt {
  display: flex; flex-direction: column; gap: 3px; text-align: start;
  border: 2px solid var(--line-3); background: #fff; border-radius: 14px;
  padding: 12px 13px; cursor: pointer; font-family: var(--font-body);
  transition: all .15s ease;
}
.opt-name { font-weight: 800; font-size: 14.5px; color: var(--ink); }
.opt-hint { font-size: 11.5px; color: var(--muted-3); line-height: 1.45; }
.opt-manager.on { border-color: var(--brand); background: #FFF6F1; }
.opt-manager.on .opt-name { color: var(--accent); }
.opt-staff.on { border-color: var(--play); background: #EAF7F4; }
.opt-staff.on .opt-name { color: #0E8C7E; }

.err { margin: 4px 0 0; background: #FEEDEC; color: var(--over); font-weight: 700; font-size: 13px; padding: 10px 13px; border-radius: 12px; }

/* ---- delete ---- */
.danger-body { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 26px; }
.warn-badge { width: 54px; height: 54px; border-radius: 50%; background: var(--over); display: flex; align-items: center; justify-content: center; }
.del-title { font-family: var(--font-head); font-weight: 800; font-size: 19px; color: var(--ink); margin: 14px 0 0; }
.del-note { font-size: 13.5px; color: var(--muted-2); line-height: 1.6; margin: 8px 0 0; }
.fc-spin.small { width: 20px; height: 20px; border-width: 3px; }

@media (max-width: 620px) {
  .team-root { padding: 20px 16px 50px; }
  .page-head { flex-direction: column; align-items: stretch; }
  .rg-head { grid-template-columns: auto auto auto; }
  .rg-hint { display: none; }
  .cards { grid-template-columns: 1fr; }
  .roles { grid-template-columns: 1fr; }
}
</style>
