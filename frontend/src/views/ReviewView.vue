<template>
  <div class="pub-root">
    <button class="lang-fab" @click="ui.toggleLang()">{{ t('lang_switch') }}</button>

    <div class="pub-shell screen-in">
      <div v-if="loading" class="pub-center"><div class="fc-spin"></div></div>

      <div v-else-if="notFound" class="pub-card pub-pad center">
        <div class="sad">🙈</div>
        <h1 class="pub-h1">{{ t('error_generic') }}</h1>
      </div>

      <!-- already answered, or just answered -->
      <div v-else-if="done || review.submitted" class="pub-card pub-pad center">
        <div class="badge-ok">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 class="pub-h1">{{ done ? t('rv_thanks') : t('rv_already') }}</h1>
        <p class="pub-sub">{{ t('rv_thanks_sub') }}</p>
        <div v-if="review.rating" class="stars-static" :aria-label="`${review.rating}/5`">
          <span v-for="n in 5" :key="n" class="star-s" :class="{ on: n <= review.rating }">★</span>
        </div>
      </div>

      <!-- the ask -->
      <form v-else class="pub-card pub-pad" @submit.prevent="submit">
        <div class="crest">💛</div>
        <h1 class="pub-h1">{{ t('rv_title') }}</h1>
        <p class="pub-sub">{{ review.child_name ? t('rv_for_child', { child: review.child_name }) : t('rv_sub') }}</p>

        <!-- Big touch targets: this is opened on a phone, one-handed. -->
        <div class="stars" role="radiogroup" :aria-label="t('rv_pick')">
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="star"
            :class="{ on: n <= (hover || rating) }"
            role="radio"
            :aria-checked="rating === n"
            :aria-label="t(`rv_${n}`)"
            @click="rating = n"
            @mouseenter="hover = n"
            @mouseleave="hover = 0"
          >★</button>
        </div>
        <div class="star-lbl">{{ rating ? t(`rv_${rating}`) : t('rv_pick') }}</div>

        <label class="lbl" for="rv-c">{{ t('rv_comment') }}</label>
        <textarea id="rv-c" v-model="comment" class="pub-area" rows="4" :placeholder="t('rv_comment_ph')"></textarea>

        <button class="fc-btn fc-btn-primary wide" type="submit" :disabled="!rating || sending">
          <span v-if="sending" class="fc-spin small"></span>
          <span v-else>{{ t('rv_submit') }}</span>
        </button>
      </form>

      <div class="pub-foot">{{ review?.center_name || t('brand') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/lib/api.js';
import { useUiStore } from '@/stores/ui.js';

const { t } = useI18n();
const route = useRoute();
const ui = useUiStore();

const loading = ref(true);
const notFound = ref(false);
const review = ref({});
const rating = ref(0);
const hover = ref(0);
const comment = ref('');
const sending = ref(false);
const done = ref(false);

onMounted(async () => {
  try {
    const { data } = await api.get(`/public/review/${route.params.token}`);
    review.value = data.review;
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
});

async function submit() {
  if (!rating.value || sending.value) return;
  sending.value = true;
  try {
    await api.post(`/public/review/${route.params.token}`, {
      rating: rating.value,
      comment: comment.value.trim() || null,
    });
    review.value.rating = rating.value;
    done.value = true;
  } catch {
    ui.toast(t('error_generic'), 'error');
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.crest { font-size: 44px; text-align: center; line-height: 1; }
.pub-h1 { font-family: var(--font-head); font-weight: 800; font-size: clamp(21px, 5.5vw, 27px); color: var(--ink); margin: 14px 0 0; text-align: center; }
.pub-sub { font-size: 14.5px; color: var(--muted-2); margin: 8px 0 0; text-align: center; line-height: 1.6; }

.stars { display: flex; justify-content: center; gap: 4px; margin: 22px 0 0; }
.star {
  background: none; border: none; cursor: pointer; padding: 6px;
  font-size: clamp(34px, 11vw, 44px); line-height: 1;
  color: var(--line-3); transition: color .12s ease, transform .12s ease;
  /* comfortably tappable on a phone without the row wrapping */
  min-width: 44px; min-height: 52px;
}
.star.on { color: var(--brand-2); }
.star:active { transform: scale(.9); }
.star-lbl { text-align: center; font-weight: 700; color: var(--muted-strong); font-size: 15px; min-height: 22px; margin-top: 2px; }

.stars-static { margin-top: 16px; font-size: 30px; letter-spacing: 3px; }
.star-s { color: var(--line-3); }
.star-s.on { color: var(--brand-2); }

.lbl { display: block; font-size: 13.5px; font-weight: 700; color: var(--muted-strong); margin: 20px 0 7px; }
.wide { width: 100%; height: 54px; margin-top: 18px; font-size: 16px; }
.fc-spin.small { width: 22px; height: 22px; border-width: 3px; }
.sad { font-size: 46px; text-align: center; }
</style>
