<template>
  <div class="ring" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle :cx="c" :cy="c" :r="r" fill="none" stroke="rgba(0,0,0,.06)" :stroke-width="stroke" />
      <circle
        :cx="c" :cy="c" :r="r" fill="none" :stroke="color" :stroke-width="stroke"
        stroke-linecap="round" :stroke-dasharray="circ" :stroke-dashoffset="dashoffset"
        :transform="`rotate(-90 ${c} ${c})`" style="transition: stroke-dashoffset .9s linear;"
      />
    </svg>
    <div class="ring-center"><slot /></div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  frac: { type: Number, default: 1 },
  color: { type: String, default: '#12A594' },
  size: { type: Number, default: 134 },
  stroke: { type: Number, default: 12 },
});
const c = computed(() => props.size / 2);
const r = computed(() => props.size / 2 - props.stroke - 3);
const circ = computed(() => 2 * Math.PI * r.value);
const dashoffset = computed(() => circ.value * (1 - Math.max(0, Math.min(1, props.frac))));
</script>

<style scoped>
.ring { position: relative; flex: none; }
.ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
</style>
