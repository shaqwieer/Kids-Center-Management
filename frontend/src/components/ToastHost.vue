<template>
  <div class="toast-host">
    <div
      v-for="tst in ui.toasts" :key="tst.id"
      class="toast" :class="tst.type"
    >
      {{ tst.msg }}
    </div>
  </div>
</template>

<script setup>
import { useUiStore } from '@/stores/ui.js';
const ui = useUiStore();
</script>

<style scoped>
/* Clears the 74px sticky header — at the top it lands on the nav. */
.toast-host {
  position: fixed; top: 88px; left: 50%; transform: translateX(-50%);
  z-index: 1000; display: flex; flex-direction: column; gap: 10px; align-items: center;
  pointer-events: none;
}
.toast {
  background: var(--ink); color: #fff; font-weight: 700; font-size: 14px;
  padding: 12px 20px; border-radius: 14px; box-shadow: 0 16px 30px -12px rgba(0, 0, 0, .4);
  animation: fcToast .25s ease; max-width: 90vw;
}
.toast.success { background: #12A594; }
.toast.error { background: #E5484D; }
.toast.warn { background: #F5A623; color: #211D1A; }
</style>
