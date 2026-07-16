<template>
  <div class="scanner">
    <!-- live camera -->
    <div v-if="state === 'scanning'" class="stage">
      <video ref="video" class="feed" playsinline muted></video>
      <div class="reticle" aria-hidden="true">
        <span class="c tl"></span><span class="c tr"></span>
        <span class="c bl"></span><span class="c br"></span>
        <span class="sweep"></span>
      </div>
      <p class="looking">{{ t('qr_looking') }}</p>
    </div>

    <!-- starting -->
    <div v-else-if="state === 'starting'" class="pane">
      <span class="fc-spin"></span>
      <p class="pane-txt">{{ t('qr_starting') }}</p>
    </div>

    <!-- something went wrong: say what, and what to do instead -->
    <div v-else-if="state === 'error'" class="pane">
      <span class="err-ic">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2.2" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      </span>
      <p class="err-title">{{ t(errorKey) }}</p>
      <p class="err-hint">{{ t('qr_use_search') }}</p>
      <button v-if="retryable" class="fc-btn fc-btn-ghost retry" type="button" @click="start">{{ t('retry') }}</button>
    </div>

    <button v-if="state === 'scanning' || state === 'starting'" class="fc-btn fc-btn-ghost stop" type="button" @click="cancel">
      {{ t('pr_cancel') }}
    </button>

    <canvas ref="canvas" class="hidden"></canvas>
  </div>
</template>

<script setup>
import {
  ref, onMounted, onBeforeUnmount, nextTick,
} from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const emit = defineEmits(['detected', 'cancel']);

const video = ref(null);
const canvas = ref(null);
const state = ref('starting'); // starting | scanning | error
const errorKey = ref('qr_err_generic');
const retryable = ref(true);

let stream = null;
let detector = null;
let jsQR = null;
let timer = null;
let stopped = false;
let detectorFails = 0;

/** Native detector where it exists (fast); jsQR everywhere else (Safari/iPad). */
async function pickDecoder() {
  try {
    if ('BarcodeDetector' in window) {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return;
      }
    }
  } catch { /* fall through to jsQR */ }
  ({ default: jsQR } = await import('jsqr'));
}

function stopCamera() {
  stopped = true;
  clearTimeout(timer);
  if (stream) {
    stream.getTracks().forEach((tr) => tr.stop());
    stream = null;
  }
}

function fail(key, canRetry = true) {
  stopCamera();
  errorKey.value = key;
  retryable.value = canRetry;
  state.value = 'error';
}

async function tick() {
  if (stopped || state.value !== 'scanning') return;
  const v = video.value;
  if (!v || v.readyState < 2) {
    timer = setTimeout(tick, 120);
    return;
  }
  try {
    let text = null;
    if (detector) {
      try {
        const found = await detector.detect(v);
        detectorFails = 0;
        if (found.length) text = found[0].rawValue;
      } catch (e) {
        // Some native detectors throw on every frame. Swallowing that would
        // spin on "looking…" forever, so give up on it and use jsQR instead.
        detectorFails += 1;
        if (detectorFails >= 5) {
          detector = null;
          ({ default: jsQR } = await import('jsqr'));
        }
        throw e;
      }
    } else if (jsQR) {
      const c = canvas.value;
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (w && h) {
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(v, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
        if (code) text = code.data;
      }
    }
    if (text) {
      stopCamera();
      emit('detected', text);
      return;
    }
  } catch { /* keep scanning — a bad frame is not a failure */ }
  timer = setTimeout(tick, 110); // ~9fps is plenty and keeps a tablet cool
}

async function start() {
  stopped = false;
  state.value = 'starting';

  // Browsers only expose a camera on a secure origin. localhost counts; a plain
  // http:// LAN address does not — that is the likeliest failure at reception.
  if (!window.isSecureContext) return fail('qr_err_insecure', false);
  if (!navigator.mediaDevices?.getUserMedia) return fail('qr_err_unsupported', false);

  try {
    await pickDecoder();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (stopped) { stopCamera(); return undefined; }
    state.value = 'scanning';
    await nextTick();
    video.value.srcObject = stream;
    await video.value.play();
    tick();
  } catch (e) {
    const n = e?.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return fail('qr_err_denied');
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return fail('qr_err_nocam', false);
    if (n === 'NotReadableError') return fail('qr_err_busy');
    return fail('qr_err_generic');
  }
  return undefined;
}

function cancel() {
  stopCamera();
  emit('cancel');
}

onMounted(start);
onBeforeUnmount(stopCamera);
</script>

<style scoped>
.scanner { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }

.stage {
  position: relative;
  width: 100%;
  max-width: 380px;
  aspect-ratio: 1 / 1;
  border-radius: var(--r-lg);
  overflow: hidden;
  background: #17130F;
}
.feed { width: 100%; height: 100%; object-fit: cover; display: block; }

.reticle { position: absolute; inset: 14%; }
.c { position: absolute; width: 26px; height: 26px; border: 3px solid #fff; }
.tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-radius: 8px 0 0 0; }
.tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-radius: 0 8px 0 0; }
.bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-radius: 0 0 0 8px; }
.br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-radius: 0 0 8px 0; }
.sweep {
  position: absolute; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, var(--brand), transparent);
  animation: qrSweep 2.2s ease-in-out infinite;
}
@keyframes qrSweep { 0%, 100% { top: 4%; } 50% { top: 96%; } }

.looking {
  position: absolute; inset-inline: 0; bottom: 10px;
  margin: 0; text-align: center;
  color: #fff; font-size: 13px; font-weight: 700;
  text-shadow: 0 1px 6px rgba(0, 0, 0, .7);
}

.pane {
  width: 100%; max-width: 380px; min-height: 190px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  padding: 20px; text-align: center;
}
.pane-txt { margin: 0; font-size: 13.5px; color: var(--muted-2); }
.err-ic { width: 46px; height: 46px; border-radius: 50%; background: #FEEDEC; display: flex; align-items: center; justify-content: center; }
.err-title { margin: 0; font-weight: 700; font-size: 14.5px; color: var(--ink); line-height: 1.5; }
.err-hint { margin: 0; font-size: 12.5px; color: var(--muted-3); }
.retry { height: 40px; padding: 0 16px; margin-top: 4px; }
.stop { height: 42px; padding: 0 20px; }

.hidden { display: none; }

@media (prefers-reduced-motion: reduce) {
  .sweep { display: none; }
}
</style>
