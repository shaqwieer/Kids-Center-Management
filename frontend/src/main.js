import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import './assets/styles.css';
import { setUnauthorizedHandler } from './lib/api.js';
import { useAuthStore } from './stores/auth.js';
import { useUiStore } from './stores/ui.js';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);

// Apply saved locale (dir/lang on <html>) before mount.
useUiStore().applyLocale();

// On any 401, log out and bounce to login.
const auth = useAuthStore();
setUnauthorizedHandler(() => {
  auth.logout();
  if (router.currentRoute.value.name !== 'login') router.push({ name: 'login' });
});

app.mount('#app');
