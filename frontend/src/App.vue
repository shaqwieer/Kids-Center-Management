<template>
  <div :dir="ui.dir" class="app-root">
    <AppHeader v-if="showChrome" />
    <router-view v-slot="{ Component }">
      <component :is="Component" :key="$route.fullPath" />
    </router-view>
    <ToastHost />
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import ToastHost from '@/components/ToastHost.vue';
import { useUiStore } from '@/stores/ui.js';
import { useAuthStore } from '@/stores/auth.js';
import { useSessionsStore } from '@/stores/sessions.js';

const ui = useUiStore();
const auth = useAuthStore();
const sessions = useSessionsStore();
const route = useRoute();

const showChrome = computed(() => !!route.meta.auth);

function startLive() {
  sessions.startClock();
  if (auth.token) sessions.connect(auth.token);
}
function stopLive() {
  sessions.stopClock();
  sessions.disconnect();
}

onMounted(() => { if (auth.isAuthed) startLive(); });
watch(() => auth.isAuthed, (v) => (v ? startLive() : stopLive()));
onBeforeUnmount(stopLive);
</script>

<style>
.app-root { min-height: 100vh; display: flex; flex-direction: column; }
</style>
