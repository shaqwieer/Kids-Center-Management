<template>
  <div class="login-root">
    <!-- ---------------- brand panel ---------------- -->
    <aside class="brand-panel">
      <div class="bp-deco" aria-hidden="true">
        <span class="blob b1"></span>
        <span class="blob b2"></span>
        <span class="blob b3"></span>
      </div>

      <div class="bp-inner">
        <BrandLogo :size="60" :show-text="true" tone="inverse" class="bp-logo" />
        <h1 class="bp-title">{{ t('login_welcome') }}</h1>
        <p class="bp-blurb">{{ t('login_blurb') }}</p>
      </div>
    </aside>

    <!-- ---------------- form panel ---------------- -->
    <main class="form-panel">
      <button class="lang-fab" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

      <div class="form-shell screen-in">
        <div class="mobile-brand">
          <BrandLogo :size="46" :show-text="true" />
        </div>

        <h2 class="f-title">{{ t('login_title') }}</h2>
        <p class="f-sub">{{ t('login_sub') }}</p>

        <form class="form" @submit.prevent="submit">
          <div class="field">
            <label class="lbl" for="lg-email">{{ t('login_email') }}</label>
            <input
              id="lg-email"
              v-model="email"
              type="email"
              class="fc-input"
              dir="ltr"
              autocomplete="username"
              required
            />
          </div>

          <div class="field">
            <label class="lbl" for="lg-pw">{{ t('login_password') }}</label>
            <div class="pw-wrap">
              <input
                id="lg-pw"
                v-model="password"
                :type="showPw ? 'text' : 'password'"
                class="fc-input"
                dir="ltr"
                autocomplete="current-password"
                required
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
          </div>

          <p v-if="error" class="err" role="alert">{{ error }}</p>

          <button class="fc-btn fc-btn-primary submit" type="submit" :disabled="loading">
            <span v-if="loading" class="fc-spin small"></span>
            <span v-else>{{ t('login_submit') }}</span>
          </button>
        </form>

        <div v-if="isDev" class="demo">
          <div class="demo-head">
            <span class="demo-title">{{ t('login_demo') }}</span>
            <span class="demo-hint">{{ t('login_demo_hint') }}</span>
          </div>

          <button
            v-for="d in DEMOS"
            :key="d.email"
            type="button"
            class="demo-row"
            :class="`dr-${d.role}`"
            @click="fill(d.email, d.password)"
          >
            <span class="dr-role">{{ t(d.labelKey) }}</span>
            <span class="dr-creds">
              <b dir="ltr">{{ d.email }}</b>
              <i dir="ltr">{{ d.password }}</i>
            </span>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BrandLogo from '@/components/BrandLogo.vue';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const { t } = useI18n();
const auth = useAuthStore();
const ui = useUiStore();
const route = useRoute();
const router = useRouter();

// Demo quick-fill is a DEV-only convenience — never shown in a production build.
const isDev = import.meta.env.DEV;
const DEMOS = [
  { role: 'manager', labelKey: 'tm_role_manager', email: 'manager@farfasha.sa', password: 'manager123' },
  { role: 'staff', labelKey: 'tm_role_staff', email: 'staff@farfasha.sa', password: 'staff123' },
];

const email = ref(isDev ? 'manager@farfasha.sa' : '');
const password = ref(isDev ? 'manager123' : '');
const showPw = ref(false);
const loading = ref(false);
const error = ref('');

function fill(e, p) { email.value = e; password.value = p; error.value = ''; }

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    await auth.login(email.value.trim(), password.value);
    router.push(route.query.redirect || { name: 'dashboard' });
  } catch (e) {
    // The API rejects in English; show the reader's language rather than echoing it.
    error.value = e?.response?.status === 401 ? t('login_error') : t('error_generic');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-root { min-height: 100vh; display: grid; grid-template-columns: 1.05fr 1fr; }

/* ---------------- brand panel ---------------- */
.brand-panel {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 56px 6vw;
  background: linear-gradient(150deg, var(--brand) 0%, #F58C4E 46%, var(--brand-2) 100%);
  color: #fff;
}
.bp-deco { position: absolute; inset: 0; pointer-events: none; }
.blob { position: absolute; border-radius: 50%; background: rgba(255, 255, 255, .11); }
.b1 { width: 320px; height: 320px; top: -90px; inset-inline-end: -80px; animation: fcFloat 13s ease-in-out infinite; }
.b2 { width: 190px; height: 190px; bottom: 8%; inset-inline-start: -60px; background: rgba(255, 255, 255, .08); animation: fcFloat 17s ease-in-out infinite reverse; }
.b3 { width: 96px; height: 96px; top: 32%; inset-inline-end: 16%; background: rgba(255, 255, 255, .07); animation: fcFloat 11s ease-in-out infinite; }

.bp-inner { position: relative; z-index: 1; max-width: 440px; }
.bp-logo { margin-bottom: 30px; }
.bp-title { font-family: var(--font-head); font-weight: 800; font-size: clamp(30px, 3.2vw, 42px); margin: 0; line-height: 1.25; }
.bp-blurb { font-size: 15.5px; line-height: 1.75; margin: 14px 0 0; opacity: .94; max-width: 40ch; }

/* ---------------- form panel ---------------- */
.form-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}
.lang-fab {
  position: absolute; top: 22px; inset-inline-end: 22px;
  height: 38px; padding: 0 15px;
  border: 2px solid var(--line-4); background: #fff; border-radius: 12px;
  color: var(--ink); font-weight: 700; font-size: 13px; cursor: pointer;
}
.lang-fab:hover { border-color: var(--brand); }

.form-shell { width: 100%; max-width: 380px; }
.mobile-brand { display: none; justify-content: center; margin-bottom: 22px; }

.f-title { font-family: var(--font-head); font-weight: 800; font-size: 26px; color: var(--ink); margin: 0; }
.f-sub { font-size: 14px; color: var(--muted-2); margin: 5px 0 26px; }

.field { margin-bottom: 15px; }
.lbl { display: block; font-size: 13px; font-weight: 700; color: var(--muted-strong); margin-bottom: 6px; }

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

.submit { width: 100%; height: 54px; font-size: 16px; margin-top: 10px; }
.err { margin: 4px 0 0; background: #FEEDEC; color: var(--over); font-weight: 700; font-size: 13.5px; padding: 10px 14px; border-radius: 12px; }
.fc-spin.small { width: 22px; height: 22px; border-width: 3px; }

/* ---------------- demo accounts ---------------- */
.demo { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--line-soft); }
.demo-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.demo-title { font-size: 12.5px; font-weight: 800; color: var(--muted-strong); }
.demo-hint { font-size: 11px; color: var(--muted-3); }

.demo-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  width: 100%; text-align: start;
  background: var(--surface-2); border: 2px solid var(--line-2); border-radius: 13px;
  padding: 10px 13px; margin-bottom: 8px; cursor: pointer;
  font-family: var(--font-body);
  transition: border-color .15s ease, background .15s ease;
}
.demo-row:hover { background: #fff; }
.dr-manager:hover { border-color: #F4C4AF; }
.dr-staff:hover { border-color: #A9DDD5; }
.dr-role { font-weight: 800; font-size: 13px; flex: none; }
.dr-manager .dr-role { color: var(--accent); }
.dr-staff .dr-role { color: #0E8C7E; }
.dr-creds { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.35; min-width: 0; }
.dr-creds b { font-size: 12.5px; font-weight: 700; color: var(--muted-strong); }
.dr-creds i { font-style: normal; font-size: 11px; color: var(--muted-3); }

/* ---------------- responsive ---------------- */
@media (max-width: 900px) {
  .login-root { grid-template-columns: 1fr; }
  .brand-panel { display: none; }
  .mobile-brand { display: flex; }
  .form-panel { align-items: flex-start; padding-top: 52px; }
  .f-title, .f-sub { text-align: center; }
}
</style>
